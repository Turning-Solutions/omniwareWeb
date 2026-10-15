import Redis from 'ioredis';
import type { Request, Response } from 'express';
import { buildFacetRequestCacheKey } from './facetRuntimeCache';

/**
 * Two-tier read-through cache for public catalog reads.
 *
 *   L1  in-process LRU (microseconds)
 *   L2  Redis, when REDIS_URL is set (shared across instances/restarts)
 *
 * Invalidation is version based: every key embeds the catalog version, and any
 * product/category/brand write bumps it (see catalogCacheInvalidation.ts), so
 * all stale entries become unreachable at once with no key scanning. Old
 * entries just age out via TTL.
 *
 * Fails open: if Redis is down or slow, requests fall back to L1 + the DB.
 * Concurrent identical misses share one computation (single-flight).
 */

const REDIS_URL = process.env.REDIS_URL;
const KEY_PREFIX = process.env.CACHE_PREFIX ?? 'omni:';
const VERSION_KEY = `${KEY_PREFIX}catalog:v`;
const CACHE_DISABLED = String(process.env.CACHE_ENABLED ?? '').toLowerCase() === 'false';

const L1_MAX_ENTRIES = Number(process.env.CACHE_L1_MAX_ENTRIES ?? 500);
/** With Redis, L1 is a short hot layer; without it L1 is the only cache. */
const L1_TTL_WITH_REDIS_MS = 5_000;
/** How often an instance re-reads the shared version from Redis. */
const VERSION_POLL_MS = 1_000;

type L1Entry = { value: string; expiresAt: number };

declare global {
    // eslint-disable-next-line no-var
    var __omniCache:
        | {
              redis: Redis | null;
              l1: Map<string, L1Entry>;
              inflight: Map<string, Promise<unknown>>;
              version: number;
              versionCheckedAt: number;
          }
        | undefined;
}

// Survive Next.js dev HMR / module re-evaluation so we don't leak connections.
const state = (globalThis.__omniCache ??= {
    redis: null,
    l1: new Map(),
    inflight: new Map(),
    version: 1,
    versionCheckedAt: 0,
});

function getRedis(): Redis | null {
    if (!REDIS_URL || CACHE_DISABLED) return null;
    if (state.redis) return state.redis;
    const client = new Redis(REDIS_URL, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2_000,
        commandTimeout: 250,
        retryStrategy: (times) => Math.min(times * 500, 5_000),
    });
    client.on('error', (err) => {
        console.warn('[cache] redis error:', err.message);
    });
    state.redis = client;
    return client;
}

export const cacheHasRedis = (): boolean => Boolean(REDIS_URL) && !CACHE_DISABLED;

/** Current catalog version, re-synced from Redis at most once per VERSION_POLL_MS. */
async function currentVersion(): Promise<number> {
    const redis = getRedis();
    if (!redis) return state.version;
    const now = Date.now();
    if (now - state.versionCheckedAt < VERSION_POLL_MS) return state.version;
    state.versionCheckedAt = now;
    try {
        const raw = await redis.get(VERSION_KEY);
        const v = raw ? Number(raw) : 1;
        if (Number.isFinite(v)) state.version = v;
    } catch {
        // keep last known version
    }
    return state.version;
}

/** Invalidates every cached catalog response (products, facets, lookups). */
export async function bumpCatalogVersion(): Promise<void> {
    state.version += 1;
    state.l1.clear();
    const redis = getRedis();
    if (!redis) return;
    try {
        const v = await redis.incr(VERSION_KEY);
        state.version = v;
        state.versionCheckedAt = Date.now();
    } catch (err) {
        console.warn('[cache] version bump failed:', (err as Error).message);
    }
}

function l1Get(key: string): string | null {
    const hit = state.l1.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
        state.l1.delete(key);
        return null;
    }
    // refresh LRU position
    state.l1.delete(key);
    state.l1.set(key, hit);
    return hit.value;
}

function l1Set(key: string, value: string, ttlMs: number): void {
    state.l1.set(key, { value, expiresAt: Date.now() + ttlMs });
    while (state.l1.size > L1_MAX_ENTRIES) {
        const oldest = state.l1.keys().next().value;
        if (oldest === undefined) break;
        state.l1.delete(oldest);
    }
}

/**
 * Returns the cached value for `key`, or computes it once (even under
 * concurrent callers) and stores it for `ttlMs`. `compute` may throw; nothing
 * is cached then. Return `undefined` from `compute` to skip caching.
 */
export async function cached<T>(
    namespace: string,
    keyPart: string,
    ttlMs: number,
    compute: () => Promise<T | undefined>
): Promise<T | undefined> {
    if (CACHE_DISABLED) return compute();

    const version = await currentVersion();
    const key = `${KEY_PREFIX}${namespace}:v${version}:${keyPart}`;

    const l1 = l1Get(key);
    if (l1 !== null) return JSON.parse(l1) as T;

    const pending = state.inflight.get(key);
    if (pending) return pending as Promise<T | undefined>;

    const run = (async (): Promise<T | undefined> => {
        const redis = getRedis();
        if (redis) {
            try {
                const raw = await redis.get(key);
                if (raw !== null) {
                    l1Set(key, raw, L1_TTL_WITH_REDIS_MS);
                    return JSON.parse(raw) as T;
                }
            } catch {
                // fall through to compute
            }
        }

        const value = await compute();
        if (value === undefined) return undefined;

        const raw = JSON.stringify(value);
        // Without Redis there is no cross-instance invalidation, so keep the
        // TTL modest; with Redis the version bump handles freshness.
        const effectiveTtl = redis ? ttlMs : Math.min(ttlMs, 60_000);
        l1Set(key, raw, redis ? Math.min(L1_TTL_WITH_REDIS_MS, effectiveTtl) : effectiveTtl);
        if (redis) {
            redis.set(key, raw, 'PX', ttlMs).catch(() => undefined);
        }
        return value;
    })().finally(() => {
        state.inflight.delete(key);
    });

    state.inflight.set(key, run);
    return run;
}

type Handler = (req: Request, res: Response) => Promise<unknown>;

/**
 * Wraps an Express handler that answers with `res.json(...)` so identical
 * public GETs are served from cache. Works for in-process calls too (the
 * `shop*Direct` loaders pass a minimal fake `res`).
 *
 * Skipped for admin paths and authenticated requests, and for any non-2xx.
 */
export function withResponseCache(
    namespace: string,
    ttlMs: number,
    handler: Handler,
    cacheControl?: string
): Handler {
    return async (req, res) => {
        const path = req.path ?? '';
        const skip = CACHE_DISABLED || path.includes('/admin') || Boolean(req.headers?.authorization);
        if (skip) return handler(req, res);
        if (cacheControl) res.set('Cache-Control', cacheControl);

        const keyPart = buildFacetRequestCacheKey((req.query ?? {}) as Record<string, unknown>) + `|p=${path}`;

        // Non-2xx results are handed back to this caller but never stored.
        let uncached: { status: number; body: unknown } | null = null;

        const result = await cached(namespace, keyPart, ttlMs, async () => {
            let status = 200;
            let body: unknown;
            let sent = false;
            const capture = {
                set() {
                    return capture;
                },
                status(code: number) {
                    status = code;
                    return capture;
                },
                json(payload: unknown) {
                    body = payload;
                    sent = true;
                    return capture;
                },
            } as unknown as Response;
            await handler(req, capture);
            if (!sent) return undefined;
            if (status >= 400) {
                uncached = { status, body };
                return undefined;
            }
            return { status, body };
        });

        if (!result) {
            const fallback = uncached as { status: number; body: unknown } | null;
            if (fallback) {
                res.status(fallback.status).json(fallback.body);
                return;
            }
            // Joined another caller's failed flight (or nothing was sent): run directly.
            return handler(req, res);
        }
        res.status(result.status).json(result.body);
    };
}
