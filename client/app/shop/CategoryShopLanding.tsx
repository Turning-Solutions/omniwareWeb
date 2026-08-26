import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import CategoryShopPageClient from "./[categorySlug]/CategoryShopPageClient";
import { titleFromSlug } from "./categoryShopMetadata";
import {
    prefetchShopFacets,
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
import { buildShopFilters, shopFacetsOptions } from "@/lib/shopFacetsQuery";
import { absoluteUrl, buildItemListStructuredData } from "@/lib/seo/productSeo";
import type { UseProductsOptions } from "@/hooks/useProducts";

import "@/server/src/models/Brand";
import "@/server/src/models/Category";

/**
 * Server-rendered category listing. Shared by the prerendered
 * `/shop-all/[categorySlug]` and the dynamic `/shop/[categorySlug]` that serves
 * filtered hard loads, so both emit identical markup. Structured-data URLs always
 * use the canonical `/shop/{slug}` path, never the internal rewrite target.
 */
export default async function CategoryShopLanding({
    normalizedSlug,
    filters,
}: {
    normalizedSlug: string;
    filters: Partial<UseProductsOptions>;
}) {
    const queryClient = new QueryClient();
    const listOptions = shopProductsListQueryOptionsForHydration(filters);
    const [listData] = await Promise.all([
        prefetchShopProductsList(queryClient, listOptions),
        prefetchShopFacets(queryClient, shopFacetsOptions(buildShopFilters(filters))),
    ]);

    const categoryName = titleFromSlug(normalizedSlug) || "PC Components";
    const itemList = listData?.products?.length
        ? buildItemListStructuredData({
            name: `${categoryName} Price in Sri Lanka | Omniware`,
            url: absoluteUrl(`/shop/${encodeURIComponent(normalizedSlug)}`),
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
                <CategoryShopPageClient normalizedSlug={normalizedSlug} initialFilters={filters} />
            </HydrationBoundary>
        </>
    );
}
