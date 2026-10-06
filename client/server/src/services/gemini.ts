/**
 * Minimal Gemini REST client for structured (JSON) output. Server-side only — the API key
 * never reaches the browser. Model is configurable via GEMINI_MODEL.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Google retires model names for new API keys over time; override with GEMINI_MODEL without a code change.
const DEFAULT_MODEL = 'gemini-3.8-flash';
const REQUEST_TIMEOUT_MS = 50_000;

export class GeminiError extends Error {
    constructor(message: string, public status?: number) {
        super(message);
        this.name = 'GeminiError';
    }
}

export const isGeminiConfigured = () => Boolean(process.env.GEMINI_API_KEY);
export const geminiModel = () => process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Call Gemini with a JSON response schema and return the parsed object. Retries rate limits / overloads. */
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

    const body = JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            temperature,
            responseMimeType: 'application/json',
            responseSchema,
        },
    });

    let lastError: GeminiError | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            const res = await fetch(`${API_BASE}/${encodeURIComponent(geminiModel())}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
                body,
                signal: controller.signal,
            });
            const json = (await res.json().catch(() => ({}))) as {
                error?: { message?: string };
                candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
            };
            if (!res.ok) {
                lastError = new GeminiError(json.error?.message || `Gemini request failed (${res.status})`, res.status);
                if (res.status === 429 || res.status >= 500) {
                    await sleep(4000 * (attempt + 1));
                    continue;
                }
                throw lastError;
            }
            const candidate = json.candidates?.[0];
            const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
            if (!text) throw new GeminiError(`Gemini returned no content (finish reason: ${candidate?.finishReason ?? 'unknown'})`);
            try {
                return JSON.parse(text) as T;
            } catch {
                throw new GeminiError(
                    candidate?.finishReason === 'MAX_TOKENS'
                        ? 'Gemini response was cut off (too long). Try a smaller chunk size.'
                        : 'Gemini returned invalid JSON.'
                );
            }
        } catch (error) {
            if (error instanceof GeminiError) throw error;
            lastError = new GeminiError(
                (error as Error).name === 'AbortError' ? 'Gemini request timed out.' : (error as Error).message
            );
            await sleep(2000 * (attempt + 1));
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError ?? new GeminiError('Gemini request failed.');
}
