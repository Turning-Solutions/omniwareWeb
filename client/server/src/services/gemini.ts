/**
 * Gemini REST adapter for structured (JSON) output. Server-side only — the API key
 * never reaches the browser.
 *
 * Every call works to a deadline (AI_TIME_BUDGET_MS, default 50s) and fails with a clear message
 * instead of letting the platform kill the request with a bare 504.
 */
import { AiError, MIN_ATTEMPT_MS, formatDuration, isDailyQuota, parseRetryAfterSeconds, sleep, timeBudgetMs } from './aiError';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Newer Gemini models "think" before answering, which is slow for a mechanical mapping task.
 * GEMINI_THINKING_LEVEL: low (default) | minimal | medium | high | off.
 */
function thinkingConfig(): Record<string, unknown> | undefined {
    const level = (process.env.GEMINI_THINKING_LEVEL ?? 'low').trim().toLowerCase();
    if (!level || level === 'off') return undefined;
    return { thinkingLevel: level };
}

type GeminiResponse = {
    error?: { message?: string; details?: { retryDelay?: string }[] };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
};

/** Call Gemini with a JSON response schema and return the parsed object. */
export async function generateGeminiJson<T>({
    model,
    systemInstruction,
    prompt,
    responseSchema,
    temperature = 0.1,
}: {
    model: string;
    systemInstruction: string;
    prompt: string;
    responseSchema: Record<string, unknown>;
    temperature?: number;
}): Promise<T> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new AiError('GEMINI_API_KEY is not set on the server.');

    const deadline = Date.now() + timeBudgetMs();
    let useThinking = thinkingConfig() !== undefined;
    let lastError: AiError | null = null;

    for (let attempt = 0; attempt < 3; attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < MIN_ATTEMPT_MS) break;

        const body = JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature,
                responseMimeType: 'application/json',
                responseSchema,
                ...(useThinking ? { thinkingConfig: thinkingConfig() } : {}),
            },
        });

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), remaining);
        try {
            const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body,
                signal: controller.signal,
            });
            const json = (await res.json().catch(() => ({}))) as GeminiResponse;

            if (!res.ok) {
                const googleMessage = json.error?.message || `Gemini request failed (${res.status})`;
                const retryAfter =
                    res.status === 429
                        ? parseRetryAfterSeconds(googleMessage, {
                              detailDelay: json.error?.details?.find((d) => typeof d.retryDelay === 'string')?.retryDelay,
                          })
                        : undefined;
                const quotaExhausted = isDailyQuota(res.status, googleMessage, retryAfter);
                console.error(`[ai:gemini] ${model} -> ${res.status}: ${googleMessage}`);

                // The model doesn't accept the thinking setting: retry once without it.
                if (res.status === 400 && useThinking && /think/i.test(googleMessage)) {
                    useThinking = false;
                    attempt -= 1;
                    continue;
                }

                lastError = new AiError(
                    res.status === 401 || res.status === 403
                        ? `Google rejected the API key / project: "${googleMessage}" Create a new key in Google AI Studio (aistudio.google.com/apikey) under a different project, update GEMINI_API_KEY and redeploy.`
                        : res.status === 404
                          ? `Gemini model "${model}" was not found or isn't available to your key: ${googleMessage}`
                          : res.status === 429
                            ? quotaExhausted
                                ? `Gemini DAILY free-tier quota used up for ${model} (resets in about ${formatDuration(retryAfter)}).`
                                : `Gemini free-tier rate limit reached (per-minute): retry in ${retryAfter ?? '?'}s.`
                            : googleMessage,
                    res.status,
                    retryAfter,
                    quotaExhausted
                );
                // A rate limit is never retried here: every extra request counts against the quota.
                if (res.status >= 500) {
                    const wait = 2000 * (attempt + 1);
                    if (deadline - Date.now() > wait + MIN_ATTEMPT_MS) {
                        await sleep(wait);
                        continue;
                    }
                }
                throw lastError;
            }

            const candidate = json.candidates?.[0];
            const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
            if (!text) {
                throw new AiError(`Gemini returned no content (finish reason: ${candidate?.finishReason ?? 'unknown'}).`);
            }
            try {
                return JSON.parse(text) as T;
            } catch {
                throw new AiError(
                    candidate?.finishReason === 'MAX_TOKENS'
                        ? 'Gemini response was cut off (too long). Reduce the chunk size.'
                        : 'Gemini returned invalid JSON.'
                );
            }
        } catch (error) {
            if (error instanceof AiError) throw error;
            const aborted = (error as Error).name === 'AbortError';
            lastError = new AiError(
                aborted
                    ? 'Gemini took too long to answer (over the time limit). It will be retried.'
                    : `Could not reach Gemini: ${(error as Error).message}`,
                aborted ? 504 : undefined
            );
            console.error(`[ai:gemini] ${model} request error:`, (error as Error).message);
            if (aborted) break;
            await sleep(1500);
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError ?? new AiError('Gemini did not answer in time.', 504);
}
