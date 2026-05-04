type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

const facetResponseCache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_FACET_CACHE_TTL_MS = 30_000;

function normalizeValue(value: unknown): string {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeValue(item)).sort().join(',');
    }
    if (value && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .map(([k, v]) => [k, normalizeValue(v)] as const)
            .sort(([a], [b]) => a.localeCompare(b));
        return entries.map(([k, v]) => `${k}:${v}`).join('|');
    }
    return String(value ?? '');
}

export function buildFacetRequestCacheKey(query: Record<string, unknown>): string {
    const normalizedEntries = Object.entries(query)
        .map(([key, value]) => [key, normalizeValue(value)] as const)
        .sort(([a], [b]) => a.localeCompare(b));
    return normalizedEntries.map(([k, v]) => `${k}=${v}`).join('&');
}

export function getFacetResponseCache<T>(key: string): T | null {
    const hit = facetResponseCache.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
        facetResponseCache.delete(key);
        return null;
    }
    return hit.value as T;
}

export function setFacetResponseCache<T>(key: string, value: T, ttlMs = DEFAULT_FACET_CACHE_TTL_MS): void {
    facetResponseCache.set(key, {
        expiresAt: Date.now() + Math.max(1_000, ttlMs),
        value,
    });
}

export function clearFacetResponseCache(): void {
    facetResponseCache.clear();
}

