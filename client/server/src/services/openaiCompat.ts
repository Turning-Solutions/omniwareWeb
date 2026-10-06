/**
 * Adapter for any OpenAI-compatible `/chat/completions` API (Groq, OpenRouter, Mistral, Cerebras,
 * Together, Fireworks, a local Ollama, …). Asks for a JSON object; if the model or provider doesn't
 * support JSON mode it retries without it and extracts the JSON from the reply.
 */
import { AiError, MIN_ATTEMPT_MS, extractJson, formatDuration, isDailyQuota, parseRetryAfterSeconds, sleep, timeBudgetMs } from './aiError';

type ChatResponse = {
    error?: { message?: string } | string;
    choices?: { message?: { content?: string | null }; finish_reason?: string }[];
};

export async function generateOpenAiCompatibleJson<T>({
    label,
    baseUrl,
    apiKey,
    keyEnv,
    model,
    systemInstruction,
    prompt,
    jsonShapeHint,
    temperature = 0.1,
    headers = {},
}: {
    label: string;
    baseUrl: string;
    apiKey?: string;
    keyEnv: string;
    model: string;
    systemInstruction: string;
    prompt: string;
    /** Plain-English description of the JSON shape; these APIs have no response schema. */
    jsonShapeHint: string;
    temperature?: number;
    headers?: Record<string, string>;
}): Promise<T> {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const deadline = Date.now() + timeBudgetMs();
    let useJsonMode = true;
    let lastError: AiError | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < MIN_ATTEMPT_MS) break;

        const body = JSON.stringify({
            model,
            temperature,
            messages: [
                { role: 'system', content: `${systemInstruction}\n\n${jsonShapeHint}` },
                { role: 'user', content: prompt },
            ],
            ...(useJsonMode ? { response_format: { type: 'json_object' } } : {}),
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), remaining);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
                    ...headers,
                },
                body,
                signal: controller.signal,
            });
            const json = (await res.json().catch(() => ({}))) as ChatResponse;

            if (!res.ok) {
                const apiMessage =
                    (typeof json.error === 'string' ? json.error : json.error?.message) || `${label} request failed (${res.status})`;
                const headerSeconds = Number(res.headers.get('retry-after'));
                const retryAfter = res.status === 429 ? parseRetryAfterSeconds(apiMessage, { headerSeconds }) : undefined;
                const quotaExhausted = isDailyQuota(res.status, apiMessage, retryAfter);
                console.error(`[ai:${label}] ${model} -> ${res.status}: ${apiMessage}`);

                // Provider/model without JSON mode: retry once as plain text and extract the JSON.
                if (res.status === 400 && useJsonMode && /response_format|json_object|json mode|json/i.test(apiMessage)) {
                    useJsonMode = false;
                    attempt -= 1;
                    continue;
                }

                lastError = new AiError(
                    res.status === 401 || res.status === 403
                        ? `${label} rejected the API key: "${apiMessage}" Check ${keyEnv} in your environment variables and redeploy.`
                        : res.status === 404
                          ? `${label} model "${model}" was not found: ${apiMessage}`
                          : res.status === 429
                            ? quotaExhausted
                                ? `${label} DAILY quota used up for ${model} (resets in about ${formatDuration(retryAfter)}): ${apiMessage}`
                                : `${label} rate limit reached: retry in ${retryAfter ?? '?'}s.`
                            : apiMessage,
                    res.status,
                    retryAfter,
                    quotaExhausted
                );
                if (res.status >= 500) {
                    const wait = 2000 * (attempt + 1);
                    if (deadline - Date.now() > wait + MIN_ATTEMPT_MS) {
                        await sleep(wait);
                        continue;
                    }
                }
                throw lastError;
            }

            const choice = json.choices?.[0];
            const text = choice?.message?.content ?? '';
            if (!text) throw new AiError(`${label} returned no content (finish reason: ${choice?.finish_reason ?? 'unknown'}).`);
            try {
                return extractJson<T>(text);
            } catch {
                throw new AiError(
                    choice?.finish_reason === 'length'
                        ? `${label} response was cut off (too long). Reduce the chunk size.`
                        : `${label} did not return valid JSON — try a different model.`
                );
            }
        } catch (error) {
            if (error instanceof AiError) throw error;
            const aborted = (error as Error).name === 'AbortError';
            lastError = new AiError(
                aborted
                    ? `${label} took too long to answer (over the time limit). It will be retried.`
                    : `Could not reach ${label}: ${(error as Error).message}`,
                aborted ? 504 : undefined
            );
            console.error(`[ai:${label}] ${model} request error:`, (error as Error).message);
            if (aborted) break;
            await sleep(1500);
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError ?? new AiError(`${label} did not answer in time.`, 504);
}
