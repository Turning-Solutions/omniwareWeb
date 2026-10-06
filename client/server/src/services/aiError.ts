/** Shared error type and helpers for the LLM provider adapters (Gemini, OpenAI-compatible APIs). */

export class AiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public retryAfterSeconds?: number,
        /** The daily quota is used up: waiting seconds won't help, it resets hours later. */
        public quotaExhausted?: boolean
    ) {
        super(message);
        this.name = 'AiError';
    }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const DEFAULT_TIME_BUDGET_MS = 50_000;
export const MIN_ATTEMPT_MS = 8_000;

/** Calls run inside a serverless function with a hard limit, so every call works to a deadline. */
export const timeBudgetMs = () =>
    Number(process.env.AI_TIME_BUDGET_MS) || Number(process.env.GEMINI_TIME_BUDGET_MS) || DEFAULT_TIME_BUDGET_MS;

/**
 * Seconds to wait, from "Please retry in 45.49s" / "try again in 6h23m52.4s" in the message,
 * a RetryInfo delay ("23032s") or a Retry-After header.
 */
export function parseRetryAfterSeconds(message: string, hints: { detailDelay?: string; headerSeconds?: number } = {}): number | undefined {
    const m = /(?:retry|try again) in (?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i.exec(message);
    if (m) return Math.ceil(Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3]));
    const fromDetail = hints.detailDelay ? /([\d.]+)s/.exec(hints.detailDelay)?.[1] : undefined;
    if (fromDetail) return Math.ceil(Number(fromDetail));
    if (hints.headerSeconds && Number.isFinite(hints.headerSeconds)) return Math.ceil(hints.headerSeconds);
    return undefined;
}

/** A rate limit that resets in hours (or says "per day") is a daily quota, not a per-minute one. */
export const isDailyQuota = (status: number, message: string, retryAfter?: number) =>
    status === 429 && ((retryAfter ?? 0) > 120 || /per[\s-]?day|daily|\bTPD\b|\bRPD\b/i.test(message));

export function formatDuration(seconds?: number): string {
    if (!seconds) return 'a few hours';
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return h ? `${h}h ${m}m` : `${m}m`;
}

/** Pull a JSON object out of a model reply that may have code fences or reasoning text around it. */
export function extractJson<T>(text: string): T {
    let t = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
    if (fence) t = fence[1].trim();
    try {
        return JSON.parse(t) as T;
    } catch {
        const start = t.indexOf('{');
        const end = t.lastIndexOf('}');
        if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1)) as T;
        throw new Error('no JSON object in reply');
    }
}
