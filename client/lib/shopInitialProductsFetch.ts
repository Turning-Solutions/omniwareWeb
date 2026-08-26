import { QueryClient } from "@tanstack/react-query";
import {
    getProductFacetsQueryOptions,
    getProductsQueryOptions,
    type ProductsResponse,
    type UseProductsOptions,
} from "@/hooks/useProducts";
import { SHOP_PRODUCTS_PER_PAGE } from "@/lib/shopConstants";
import { fetchShopProductsDirect } from "@/lib/server/shopProductsDirect";
import { fetchShopFacetsDirect } from "@/lib/server/shopFacetsDirect";

export async function fetchShopProductsJson(options: UseProductsOptions): Promise<ProductsResponse> {
    // In-process controller call — no HTTP loopback. Fetching our own public URL
    // during SSR was slow/unreliable on the production host and left shop pages
    // without server-rendered product links (bad for crawling/indexing).
    return fetchShopProductsDirect(options);
}

export function readProductsTotal(
    data: ProductsResponse & { pagination?: { total?: number } }
): number {
    if (typeof data.total === "number") return data.total;
    return data.pagination?.total ?? 0;
}

export async function fetchShopSearchResultTotal(options: UseProductsOptions): Promise<number> {
    const data = await fetchShopProductsJson({
        ...options,
        limit: 1,
        page: 1,
        includeFacets: false,
    });
    return readProductsTotal(data);
}

export async function prefetchShopProductsList(
    queryClient: QueryClient,
    options: UseProductsOptions
): Promise<ProductsResponse | null> {
    try {
        return await queryClient.fetchQuery({
            ...getProductsQueryOptions(options),
            queryFn: () => fetchShopProductsJson(options),
            staleTime: 2 * 60 * 1000,
        });
    } catch (error) {
        // Keep listing pages rendering even if the initial product fetch fails;
        // the client grid refetches on mount.
        console.error("[shop] SSR product list prefetch failed:", error);
        return null;
    }
}

/**
 * Longest we let the facets aggregation hold up SSR. If it overruns we ship the
 * page without hydrated facets and the client fetches them exactly as before —
 * a slow facet query degrades the sidebar, it never delays the product grid.
 */
const FACETS_SSR_BUDGET_MS = 1200;

export async function fetchShopFacetsJson(options: UseProductsOptions): Promise<unknown> {
    // In-process controller call — same reasoning as the product list above.
    return fetchShopFacetsDirect(options);
}

/**
 * Hydrate the filter sidebar from SSR. Without this the sidebar has no data until
 * the browser has downloaded, parsed and hydrated the page bundle and then made a
 * round trip of its own — seconds after the product grid is already painted.
 *
 * `options` must come from `shopFacetsOptions()` so the key matches the client's
 * `useProductFacets` query exactly; otherwise this warms a key nobody reads.
 */
export async function prefetchShopFacets(queryClient: QueryClient, options: UseProductsOptions) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            queryClient.prefetchQuery({
                ...getProductFacetsQueryOptions(options),
                queryFn: () => fetchShopFacetsJson(options),
                staleTime: 2 * 60 * 1000,
            }),
            new Promise<void>((resolve) => {
                timer = setTimeout(resolve, FACETS_SSR_BUDGET_MS);
            }),
        ]);
    } catch (error) {
        console.error("[shop] SSR facets prefetch failed:", error);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/** Options object must match `useProducts({ ...filters, limit, includeFacets })` for the default shop list. */
export function shopProductsListQueryOptionsForHydration(params: Partial<UseProductsOptions> = {}): UseProductsOptions {
    const page = params.page !== undefined && params.page >= 1 ? Math.floor(params.page) : 1;
    const o: UseProductsOptions = {
        search: typeof params.search === "string" ? params.search : "",
        sort: params.sort && String(params.sort).trim() ? String(params.sort).trim() : "newest",
        page,
        limit: SHOP_PRODUCTS_PER_PAGE,
        includeFacets: false,
    };
    if (params.category) {
        o.category = params.category;
    }
    if (params.subcategories?.trim()) {
        o.subcategories = params.subcategories.trim();
    }
    if (params.brand) {
        o.brand = params.brand;
    }
    if (params.minPrice != null && !Number.isNaN(Number(params.minPrice))) {
        o.minPrice = Number(params.minPrice);
    }
    if (params.maxPrice != null && !Number.isNaN(Number(params.maxPrice))) {
        o.maxPrice = Number(params.maxPrice);
    }
    if (params.availability) {
        o.availability = params.availability;
    }
    if (params.inStock) {
        o.inStock = params.inStock;
    }
    if (params.isFeatured != null) {
        o.isFeatured = params.isFeatured;
    }
    if (params.spec && typeof params.spec === "object") {
        o.spec = params.spec;
    }
    return o;
}
