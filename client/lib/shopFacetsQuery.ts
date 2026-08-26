import type { UseProductsOptions } from "@/hooks/useProducts";
import { hasShopFacetNarrowing } from "@/lib/shopUrlFilters";

export type ShopFilters = UseProductsOptions & Record<string, unknown>;

/** Starting filter state for every shop listing (plain `/shop`, category pages, SSR prefetch). */
export const SHOP_DEFAULT_FILTERS: ShopFilters = { search: "", sort: "newest", page: 1 };

/**
 * The `filters` state a shop listing mounts with. The SSR facet prefetch has to
 * reproduce this exactly, so both sides build it here rather than each spreading
 * their own defaults.
 */
export function buildShopFilters(initialFilters: Partial<UseProductsOptions> = {}): ShopFilters {
    return { ...SHOP_DEFAULT_FILTERS, ...initialFilters };
}

/**
 * Facet query options for a filter state — and therefore the React Query cache key
 * (`['product-facets', options]`).
 *
 * `page` and `sort` never change which facet values exist, so they are dropped:
 * paging or re-sorting reuses the cached facets instead of re-running the
 * aggregation. Every caller (SSR prefetch, hover prefetch, live `useProductFacets`)
 * MUST derive its options here — building them ad hoc produces a structurally
 * different key that silently never hits the cache.
 */
export function shopFacetsOptions(filters: ShopFilters): UseProductsOptions {
    const rest: ShopFilters = { ...filters };
    delete rest.page;
    delete rest.sort;
    return { ...rest, facetMode: hasShopFacetNarrowing(rest) ? "full" : "lite" };
}
