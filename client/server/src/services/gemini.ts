/**
 * Minimal Gemini REST client for structured (JSON) output. Server-side only — the API key
 * never reaches the browser. Model is configurable via GEMINI_MODEL.
 *
 * Calls run inside a serverless function with a hard time limit, so every call works to a
 * deadline (GEMINI_TIME_BUDGET_MS, default 50s) and fails with a clear message instead of
 * letting the platform kill the request with a bare 504.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Google retires model names for new API keys over time; override with GEMINI_MODEL without a code change.
const DEFAULT_MODEL = 'gemini-3.8-flash';
const DEFAULT_TIME_BUDGET_MS = 50_000;
const MIN_ATTEMPT_MS = 8_000;

export class GeminiError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'GeminiError';
    }
}

export const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const geminiModel = () => process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
};

/** Call Gemini with a JSON response schema and return the parsed object. */
export async function generateJson<T>({
    systemInstruction,
    prompt,
    responseSchema,
    temperature = 0.1,
}: {
    systemInstruction: string;
    prompt: string;
    responseSchema: Record<string, unknown>;
    temperature?: number;
}): Promise<T> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new GeminiError('GEMINI_API_KEY is not set on the server.');

    const deadline = Date.now() + (Number(process.env.GEMINI_TIME_BUDGET_MS) || DEFAULT_TIME_BUDGET_MS);
    const model = geminiModel();
    let useThinking = thinkingConfig() !== undefined;
    let lastError: GeminiError | null = null;

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
                console.error(`[gemini] ${model} -> ${res.status}: ${googleMessage}`);

                // The model doesn't accept the thinking setting: retry once without it.
                if (res.status === 400 && useThinking && /think/i.test(googleMessage)) {
                    useThinking = false;
                    attempt -= 1;
                    continue;
                }

                lastError = new GeminiError(
                    res.status === 401 || res.status === 403
                        ? `Google rejected the API key / project: "${googleMessage}" Create a new key in Google AI Studio (aistudio.google.com/apikey) under a different project, update GEMINI_API_KEY and redeploy.`
                        : res.status === 429
                          ? `Gemini rate limit reached: ${googleMessage}`
                          : googleMessage,
                    res.status
                );
                if (res.status === 429 || res.status >= 500) {
                    // Short backoff, and only if there is still time for another attempt.
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
                throw new GeminiError(`Gemini returned no content (finish reason: ${candidate?.finishReason ?? 'unknown'}).`);
            }
            try {
                return JSON.parse(text) as T;
            } catch {
                throw new GeminiError(
                    candidate?.finishReason === 'MAX_TOKENS'
                        ? 'Gemini response was cut off (too long). Reduce the chunk size.'
                        : 'Gemini returned invalid JSON.'
                );
            }
        } catch (error) {
            if (error instanceof GeminiError) throw error;
            const aborted = (error as Error).name === 'AbortError';
            lastError = new GeminiError(
                aborted
                    ? 'Gemini took too long to answer (over the time limit). It will be retried with a smaller part.'
                    : `Could not reach Gemini: ${(error as Error).message}`,
                aborted ? 504 : undefined
            );
            console.error(`[gemini] ${model} request error:`, (error as Error).message);
            if (aborted) break; // no time left for another attempt
            await sleep(1500);
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError ?? new GeminiError('Gemini did not answer in time.', 504);
}
