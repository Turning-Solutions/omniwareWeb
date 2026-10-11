/** Shared handling of AI-backed admin requests: readable errors, what to retry, and how long to wait. */

type ApiError = {
    response?: { status?: number; data?: { message?: string; retryable?: boolean; quotaExhausted?: boolean; retryAfterSeconds?: number } };
    message?: string;
};

export function errorMessage(err: unknown, fallback: string): string {
    const e = err as ApiError;
    const status = e?.response?.status;
    if (status === 401) return "Your admin session has expired — log in again.";
    if (e?.response?.data?.message) return e.response.data.message;
    if (status === 504) return "The server timed out before the AI answered (HTTP 504).";
    if (status) return `${fallback} (HTTP ${status})`;
    return e?.message ? `${fallback} (${e.message})` : fallback;
}

/** Worth retrying automatically: rate limits, overloads, platform timeouts, network blips — not daily limits. */
export function isRetryable(err: unknown): boolean {
    const e = err as ApiError;
    const status = e?.response?.status;
    if (e?.response?.data?.quotaExhausted || e?.response?.data?.retryable === false) return false;
    return status === undefined || status === 429 || status === 502 || status === 503 || status === 504;
}

export const isQuotaExhausted = (err: unknown) => Boolean((err as ApiError)?.response?.data?.quotaExhausted);

/** Seconds to wait before retrying: what the provider asked for, else a sensible default. */
export function retryWaitSeconds(err: unknown): number {
    const e = err as ApiError;
    if (e?.response?.data?.retryAfterSeconds) return e.response.data.retryAfterSeconds + 2;
    return e?.response?.status === 429 ? 30 : 4;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
