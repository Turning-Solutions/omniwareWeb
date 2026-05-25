import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ShopPageClient from "./ShopPageClient";
import { prefetchShopProductsList, shopProductsListQueryOptionsForHydration } from "@/lib/shopInitialProductsFetch";
import { parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";

// Register models so populate() works if the API handler runs in this context.
import "@/server/src/models/Brand";
import "@/server/src/models/Category";

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
    // Keep initial SSR focused on the first product page only.
    // Facets are fetched client-side in the background by `ShopContent`.
    await prefetchShopProductsList(queryClient, listOptions);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ShopPageClient initialFilters={parsed} />
        </HydrationBoundary>
    );
}
