/**
 * Adapter for any OpenAI-compatible `/chat/completions` API (Groq, OpenRouter, Mistral, Cerebras,
 * Together, Fireworks, a local Ollama, …). Asks for a JSON object; if the model or provider doesn't
 * support JSON mode it retries without it and extracts the JSON from the reply.
 */
import { AiError, MIN_ATTEMPT_MS, extractJson, formatDuration, isDailyQuota, parseRetryAfterSeconds, sleep, timeBudgetMs } from './aiError';

type ChatResponse = {
    error?: { message?: string; code?: number | string; metadata?: { raw?: unknown; provider_name?: string } } | string;
    model?: string;
    provider?: string;
    choices?: {
        message?: { content?: string | null; reasoning?: string | null; reasoning_content?: string | null };
        finish_reason?: string;
    }[];
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
    let emptyRetries = 0;
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

            // OpenRouter can report an upstream failure inside a 200 response (no choices, an "error" object).
            const embeddedError = res.ok && !json.choices?.length && Boolean(json.error);
            if (!res.ok || embeddedError) {
                const status = res.ok ? Number(typeof json.error === 'object' ? json.error?.code : NaN) || 502 : res.status;
                // OpenRouter wraps the upstream provider's real reason in error.metadata.raw.
                const meta = typeof json.error === 'object' ? json.error?.metadata : undefined;
                const raw = typeof meta?.raw === 'string' ? meta.raw : meta?.raw ? JSON.stringify(meta.raw) : '';
                const apiMessage =
                    [(typeof json.error === 'string' ? json.error : json.error?.message) || `${label} request failed (${status})`, raw]
                        .filter(Boolean)
                        .join(' — ')
                        .slice(0, 400) + (meta?.provider_name ? ` [via ${meta.provider_name}]` : '');
                // Retry-After (seconds) or OpenRouter's X-RateLimit-Reset (epoch milliseconds).
                const resetMs = Number(res.headers.get('x-ratelimit-reset'));
                const headerSeconds =
                    Number(res.headers.get('retry-after')) || (resetMs > Date.now() ? Math.ceil((resetMs - Date.now()) / 1000) : NaN);
                const retryAfter = status === 429 ? parseRetryAfterSeconds(apiMessage, { headerSeconds }) : undefined;
                const quotaExhausted = isDailyQuota(status, apiMessage, retryAfter);
                console.error(`[ai:${label}] ${model} -> ${status}: ${apiMessage}`);

                // Provider/model without JSON mode: retry once as plain text and extract the JSON.
                if (status === 400 && useJsonMode && /response_format|json_object|json mode|json/i.test(apiMessage)) {
                    useJsonMode = false;
                    attempt -= 1;
                    continue;
                }

                lastError = new AiError(
                    status === 401 || status === 403
                        ? `${label} rejected the API key: "${apiMessage}" Check ${keyEnv} in your environment variables and redeploy.`
                        : status === 404
                          ? `${label} model "${model}" was not found: ${apiMessage}`
                          : status === 429
                            ? quotaExhausted
                                ? `${label} DAILY quota used up for ${model} (resets in about ${formatDuration(retryAfter)}): ${apiMessage}`
                                : `${label} rate limit reached${retryAfter ? ` (retry in ${retryAfter}s)` : ''}: ${apiMessage}`
                            : apiMessage,
                    status,
                    retryAfter,
                    quotaExhausted
                );
                if (status >= 500) {
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
            const reasoning = choice?.message?.reasoning ?? choice?.message?.reasoning_content ?? '';
            if (!text.trim()) {
                // Some "thinking" models leave `content` empty and put the answer in the reasoning text.
                if (reasoning.trim()) {
                    try {
                        return extractJson<T>(reasoning);
                    } catch {
                        // fall through to the empty-answer handling
                    }
                }
                console.error(
                    `[ai:${label}] ${model} empty answer (finish=${choice?.finish_reason ?? 'unknown'}, served by ${json.provider ?? json.model ?? '?'}, reasoning=${reasoning.length} chars)`
                );
                // Free models often return an empty reply when overloaded — one quick retry is cheap.
                if (emptyRetries < 1 && deadline - Date.now() > MIN_ATTEMPT_MS * 2) {
                    emptyRetries += 1;
                    await sleep(1500);
                    continue;
                }
                const finish = choice?.finish_reason ?? 'unknown';
                throw new AiError(
                    `${label} returned an empty answer (model ${model}${json.provider ? `, served by ${json.provider}` : ''}, finish reason: ${finish}). ` +
                        (reasoning.trim() || finish === 'length'
                            ? 'It spent its output on internal reasoning and ran out of room — pick a model without "thinking" or reduce the chunk size (GEMINI_CHUNK_SIZE / AI_CHUNK_SIZE).'
                            : 'Free models sometimes do this when overloaded — retry, or pick another model.')
                );
            }
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
