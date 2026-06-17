import type { Metadata } from "next";
import { notFound } from "next/navigation";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | undefined {
    if (Array.isArray(value)) return value[0];
    return value;
}

/** Reads WordPress-style `s`, shop `search`, or `q` query params. */
export function getSearchQueryFromParams(sp: SearchParamsRecord): string | undefined {
    const raw = firstParam(sp.s) ?? firstParam(sp.search) ?? firstParam(sp.q);
    const trimmed = raw?.trim();
    return trimmed || undefined;
}

/** True when the URL includes a legacy `?s=` param (even if empty). */
export function hasLegacySearchParam(sp: SearchParamsRecord): boolean {
    return Object.prototype.hasOwnProperty.call(sp, "s");
}

export const SEARCH_PAGE_ROBOTS: NonNullable<Metadata["robots"]> = {
    index: false,
    follow: true,
};

export function withSearchPageRobots(metadata: Metadata): Metadata {
    return {
        ...metadata,
        robots: SEARCH_PAGE_ROBOTS,
    };
}

export async function ensureSearchHasResults(searchQuery: string | undefined, total: number): Promise<void> {
    if (!searchQuery) return;
    if (total <= 0) notFound();
}
