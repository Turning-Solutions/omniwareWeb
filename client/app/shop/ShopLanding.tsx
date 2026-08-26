import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ShopPageClient from "./ShopPageClient";
import { shopTitle, shopUrl } from "./shopMetadata";
import {
    prefetchShopFacets,
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
import { buildShopFilters, shopFacetsOptions } from "@/lib/shopFacetsQuery";
import { buildItemListStructuredData } from "@/lib/seo/productSeo";
import type { UseProductsOptions } from "@/hooks/useProducts";

// Register models so populate() works if the API handler runs in this context.
import "@/server/src/models/Brand";
import "@/server/src/models/Category";

/**
 * Server-rendered shop listing. Shared by the prerendered landing (`/shop-all`,
 * which `/shop` is rewritten to when no filters are present) and the dynamic
 * `/shop` route that serves filtered hard loads — so both emit identical markup.
 */
export default async function ShopLanding({
    filters = {},
}: {
    filters?: Partial<UseProductsOptions>;
}) {
    const queryClient = new QueryClient();
    const listOptions = shopProductsListQueryOptionsForHydration(filters);
    // Hydrate the grid AND the filter sidebar. Both run in parallel, so SSR costs
    // roughly the slower of the two rather than their sum; `prefetchShopFacets`
    // gives up after its own budget so facets can never stall the product grid.
    const [listData] = await Promise.all([
        prefetchShopProductsList(queryClient, listOptions),
        prefetchShopFacets(queryClient, shopFacetsOptions(buildShopFilters(filters))),
    ]);

    const itemList = listData?.products?.length
        ? buildItemListStructuredData({
            name: shopTitle,
            url: shopUrl,
            products: listData.products,
        })
        : null;

    return (
        <>
            {itemList && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(itemList).replace(/</g, "\\u003c"),
                    }}
                />
            )}
            <HydrationBoundary state={dehydrate(queryClient)}>
                <ShopPageClient initialFilters={filters} />
            </HydrationBoundary>
        </>
    );
}
