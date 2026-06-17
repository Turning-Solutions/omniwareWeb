import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import ShopPageClient from "./ShopPageClient";
import {
    fetchShopSearchResultTotal,
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
import { parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";
import {
    absoluteUrl,
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_IMAGE_HEIGHT,
    DEFAULT_OG_IMAGE_WIDTH,
    SITE_NAME,
} from "@/lib/seo/productSeo";
import {
    ensureSearchHasResults,
    getSearchQueryFromParams,
    withSearchPageRobots,
    type SearchParamsRecord,
} from "@/lib/seo/searchPageSeo";

// Register models so populate() works if the API handler runs in this context.
import "@/server/src/models/Brand";
import "@/server/src/models/Category";

/**
 * ISR: the default (no-filter) shop page is cached at the edge.
 * Filtered URLs (searchParams) still revalidate but the unfiltered landing
 * is instant for most visitors.
 */
export const revalidate = 60;

const shopTitle = "Shop PC Components & Custom Builds in Sri Lanka | Omniware";
const shopDescription =
    "Buy PC components, gaming hardware, accessories, and custom PC builds in Sri Lanka with local warranty support from Omniware.";
const shopUrl = absoluteUrl("/shop");
const shopImageUrl = absoluteUrl(DEFAULT_OG_IMAGE);

const baseShopMetadata: Metadata = {
    title: shopTitle,
    description: shopDescription,
    keywords: [
        "PC components Sri Lanka",
        "custom PC builds Sri Lanka",
        "gaming PC Sri Lanka",
        "computer parts Sri Lanka",
        "buy PC parts Sri Lanka",
    ],
    alternates: {
        canonical: shopUrl,
    },
    openGraph: {
        type: "website",
        locale: "en_LK",
        siteName: SITE_NAME,
        title: shopTitle,
        description: shopDescription,
        url: shopUrl,
        images: [{
            url: shopImageUrl,
            alt: "Omniware PC components and custom builds in Sri Lanka",
            width: DEFAULT_OG_IMAGE_WIDTH,
            height: DEFAULT_OG_IMAGE_HEIGHT,
        }],
    },
    twitter: {
        card: "summary_large_image",
        title: shopTitle,
        description: shopDescription,
        images: [shopImageUrl],
    },
};

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
