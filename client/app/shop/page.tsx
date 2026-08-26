import type { Metadata } from "next";
import ShopLanding from "./ShopLanding";
import { baseShopMetadata } from "./shopMetadata";
import {
    fetchShopSearchResultTotal,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
import { parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";
import {
    ensureSearchHasResults,
    getSearchQueryFromParams,
    withSearchPageRobots,
    type SearchParamsRecord,
} from "@/lib/seo/searchPageSeo";

/**
 * This route awaits `searchParams`, which forces dynamic rendering — `revalidate`
 * would be ignored here, so it is deliberately absent. Unfiltered `/shop` requests
 * never reach this route: `proxy.ts` rewrites them to the prerendered `/shop-all`.
 * What lands here is filtered/searched hard loads, which are per-URL anyway.
 */

interface ShopPageProps {
    searchParams?: Promise<SearchParamsRecord>;
}

export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
    const sp = searchParams ? await searchParams : {};
    if (getSearchQueryFromParams(sp)) {
        return withSearchPageRobots(baseShopMetadata);
    }
    return baseShopMetadata;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
    const sp = searchParams ? await searchParams : {};
    const parsed = parseShopFiltersFromRouter("/shop", sp);
    const searchQuery = getSearchQueryFromParams(sp);

    if (searchQuery) {
        const total = await fetchShopSearchResultTotal(shopProductsListQueryOptionsForHydration(parsed));
        await ensureSearchHasResults(searchQuery, total);
    }

    return <ShopLanding filters={parsed} />;
}
