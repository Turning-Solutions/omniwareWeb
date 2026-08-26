import type { Metadata } from "next";
import CategoryShopLanding from "../CategoryShopLanding";
import { buildCategoryShopMetadata, normalizeCategorySlug } from "../categoryShopMetadata";
import {
    fetchShopSearchResultTotal,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
import {
    ensureSearchHasResults,
    getSearchQueryFromParams,
    withSearchPageRobots,
} from "@/lib/seo/searchPageSeo";
import { parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";

/**
 * Filtered category listings only. Unfiltered `/shop/{slug}` requests are rewritten
 * by `proxy.ts` to the prerendered `/shop-all/{slug}`.
 *
 * This route awaits `searchParams`, so it is dynamic and `revalidate` would be
 * ignored — hence its absence. `generateStaticParams` is deliberately absent too:
 * pairing it with `searchParams` made Next generate unlisted slugs in a static
 * context, which threw DYNAMIC_SERVER_USAGE (a 500) for any category not present
 * at build time. Prerendering now lives on the `/shop-all` route, which uses no
 * request-time API at all.
 */

interface CategoryShopPageProps {
    params: Promise<{
        categorySlug: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: CategoryShopPageProps): Promise<Metadata> {
    const { categorySlug } = await params;
    const sp = searchParams ? await searchParams : {};
    const metadata = await buildCategoryShopMetadata(categorySlug);

    if (getSearchQueryFromParams(sp)) {
        return withSearchPageRobots(metadata);
    }

    return metadata;
}

export default async function CategoryShopPage({ params, searchParams }: CategoryShopPageProps) {
    const { categorySlug } = await params;
    const normalizedSlug = normalizeCategorySlug(categorySlug);
    const sp = searchParams ? await searchParams : {};
    const pathname = `/shop/${encodeURIComponent(normalizedSlug)}`;
    const parsed = parseShopFiltersFromRouter(pathname, sp);
    const searchQuery = getSearchQueryFromParams(sp);

    if (searchQuery) {
        const total = await fetchShopSearchResultTotal(shopProductsListQueryOptionsForHydration(parsed));
        await ensureSearchHasResults(searchQuery, total);
    }

    return <CategoryShopLanding normalizedSlug={normalizedSlug} filters={parsed} />;
}
