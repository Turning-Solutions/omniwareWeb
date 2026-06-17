import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import CategoryShopPageClient from "./CategoryShopPageClient";
import {
    fetchShopSearchResultTotal,
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
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
import { parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";
import { ensureDb } from "@/server/src/config/db";
import Category from "@/server/src/models/Category";
import "@/server/src/models/Brand";

/** ISR: category shop pages are edge-cached and revalidated. */
export const revalidate = 60;

type CategorySeoDocument = {
    name?: string;
    slug?: string;
    updatedAt?: Date;
};

interface CategoryShopPageProps {
    params: Promise<{
        categorySlug: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeCategorySlug(value: string): string {
    return decodeURIComponent(value).trim().toLowerCase();
}

function titleFromSlug(slug: string): string {
    return slug
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

async function fetchCategorySeoBySlug(slug: string): Promise<CategorySeoDocument | null> {
    await ensureDb();
    const category = await Category.findOne({ slug, isActive: true })
        .select("name slug updatedAt")
        .lean();
    return category as CategorySeoDocument | null;
}

export async function generateMetadata({ params, searchParams }: CategoryShopPageProps): Promise<Metadata> {
    const { categorySlug } = await params;
    const sp = searchParams ? await searchParams : {};
    const normalizedSlug = normalizeCategorySlug(categorySlug);
    const category = await fetchCategorySeoBySlug(normalizedSlug);
    const categoryName = category?.name?.trim() || titleFromSlug(normalizedSlug) || "PC Components";
    const canonicalPath = `/shop/${encodeURIComponent(category?.slug || normalizedSlug)}`;
    const canonicalUrl = absoluteUrl(canonicalPath);
    const title = `${categoryName} Price in Sri Lanka | Omniware`;
    const description =
        `Buy ${categoryName} in Sri Lanka from Omniware. Compare latest PC components, prices, availability, and local warranty options.`;
    const imageUrl = absoluteUrl(DEFAULT_OG_IMAGE);

    const metadata: Metadata = {
        title,
        description,
        keywords: [
            `${categoryName} Sri Lanka`,
            `${categoryName} price in Sri Lanka`,
            `buy ${categoryName} Sri Lanka`,
            "PC components Sri Lanka",
            "Omniware",
        ],
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            type: "website",
            locale: "en_LK",
            siteName: SITE_NAME,
            title,
            description,
            url: canonicalUrl,
            images: [{
                url: imageUrl,
                alt: `${categoryName} available from Omniware Sri Lanka`,
                width: DEFAULT_OG_IMAGE_WIDTH,
                height: DEFAULT_OG_IMAGE_HEIGHT,
            }],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
        },
    };

    if (getSearchQueryFromParams(sp)) {
        return withSearchPageRobots(metadata);
    }

    return metadata;
}

export async function generateStaticParams() {
    await ensureDb();
    const categories = await Category.find({
        isActive: true,
        slug: { $type: "string", $ne: "" },
    })
        .select("slug")
        .lean<CategorySeoDocument[]>();

    return categories.flatMap((category) =>
        category.slug ? [{ categorySlug: category.slug }] : []
    );
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

    const queryClient = new QueryClient();
    const listOptions = shopProductsListQueryOptionsForHydration(parsed);
    await prefetchShopProductsList(queryClient, listOptions);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <CategoryShopPageClient normalizedSlug={normalizedSlug} initialFilters={parsed} />
        </HydrationBoundary>
    );
}
