import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ShopPageClient from "./ShopPageClient";
import {
    prefetchShopFacets,
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
import { hasShopFacetNarrowing, parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";

/**
 * ISR: the default (no-filter) shop page is cached at the edge.
 * Filtered URLs (searchParams) still revalidate but the unfiltered landing
 * is instant for most visitors.
 */
export const revalidate = 60;

interface ShopPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
    const sp = searchParams ? await searchParams : {};
    const parsed = parseShopFiltersFromRouter("/shop", sp);

    const queryClient = new QueryClient();
    const listOptions = shopProductsListQueryOptionsForHydration(parsed);
    const facetOptions = {
        ...listOptions,
        facetMode: hasShopFacetNarrowing(parsed) ? ("full" as const) : ("lite" as const),
    };
    await Promise.all([
        prefetchShopProductsList(queryClient, listOptions),
        prefetchShopFacets(queryClient, facetOptions),
    ]);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ShopPageClient initialFilters={parsed} />
        </HydrationBoundary>
    );
}
