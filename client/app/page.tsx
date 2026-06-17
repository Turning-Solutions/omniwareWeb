import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import HomePageClient from "./HomePageClient";
import {
    countActiveProductsBySearchDirect,
    fetchPromotionsDirect,
    fetchPartnersDirect,
    fetchHomeSettingsDirect,
    fetchProductsDirect,
} from "@/lib/server/homeData";
import { HOME_PROMOTIONS_QUERY_KEY } from "@/lib/homePromotionsQuery";
import { HOME_PARTNERS_QUERY_KEY } from "@/lib/homePartnersQuery";
import { HOME_SETTINGS_QUERY_KEY } from "@/lib/homeSettingsQuery";
import { getHomeFeaturedProductsQueryOptions, HOME_FEATURED_PRODUCTS_OPTIONS } from "@/lib/homeFeaturedProductsQuery";
import { getHomeDiscountedProductsQueryOptions, HOME_DISCOUNTED_PRODUCTS_OPTIONS } from "@/lib/homeDiscountedProductsQuery";
import {
    absoluteUrl,
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_IMAGE_HEIGHT,
    DEFAULT_OG_IMAGE_WIDTH,
    SITE_NAME,
    getSiteUrl,
} from "@/lib/seo/productSeo";
import {
    getSearchQueryFromParams,
    hasLegacySearchParam,
    withSearchPageRobots,
    type SearchParamsRecord,
} from "@/lib/seo/searchPageSeo";

/**
 * ISR: serve a cached static page and revalidate in the background at most
 * every 60 s.  Admin mutations call /api/internal/revalidate for instant refresh.
 */
export const revalidate = 60;

const homeTitle = "Omniware.lk | Custom PC Builds & Components in Sri Lanka";
const homeDescription =
    "Build or upgrade your PC with Omniware. Shop gaming PCs, computer components, accessories, and carefully selected hardware in Sri Lanka.";
const homeUrl = absoluteUrl("/");
const homeImageUrl = absoluteUrl(DEFAULT_OG_IMAGE);

const baseHomeMetadata: Metadata = {
    title: homeTitle,
    description: homeDescription,
    keywords: [
        "custom PC builds Sri Lanka",
        "gaming PC Sri Lanka",
        "PC components Sri Lanka",
        "computer accessories Sri Lanka",
        "Omniware",
    ],
    alternates: {
        canonical: homeUrl,
    },
    openGraph: {
        type: "website",
        locale: "en_LK",
        siteName: SITE_NAME,
        title: homeTitle,
        description: homeDescription,
        url: homeUrl,
        images: [{
            url: homeImageUrl,
            alt: "Omniware custom PC builds and components in Sri Lanka",
            width: DEFAULT_OG_IMAGE_WIDTH,
            height: DEFAULT_OG_IMAGE_HEIGHT,
        }],
    },
    twitter: {
        card: "summary_large_image",
        title: homeTitle,
        description: homeDescription,
        images: [homeImageUrl],
    },
};

interface HomePageProps {
    searchParams?: Promise<SearchParamsRecord>;
}

export async function generateMetadata({ searchParams }: HomePageProps): Promise<Metadata> {
    const sp = searchParams ? await searchParams : {};
    if (hasLegacySearchParam(sp)) {
        return withSearchPageRobots(baseHomeMetadata);
    }
    return baseHomeMetadata;
}

function buildHomeStructuredData() {
    const siteUrl = getSiteUrl();
    const logoUrl = absoluteUrl(DEFAULT_OG_IMAGE);

    return [
        {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: SITE_NAME,
            url: siteUrl,
            potentialAction: {
                "@type": "SearchAction",
                target: `${absoluteUrl("/shop")}?q={search_term_string}`,
                "query-input": "required name=search_term_string",
            },
        },
        {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: SITE_NAME,
            url: siteUrl,
            logo: logoUrl,
            image: logoUrl,
            contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                areaServed: "LK",
                availableLanguage: ["en"],
            },
        },
    ];
}

export default async function HomePage({ searchParams }: HomePageProps) {
    const sp = searchParams ? await searchParams : {};
    if (hasLegacySearchParam(sp)) {
        const query = getSearchQueryFromParams(sp);
        if (!query) notFound();

        const total = await countActiveProductsBySearchDirect(query);
        if (total === 0) notFound();

        redirect(`/shop?search=${encodeURIComponent(query)}`);
    }

    const queryClient = new QueryClient();

    // All 5 queries run in parallel — direct MongoDB, no HTTP loopback.
    const [promotions, partners, settings, featured, discounted] = await Promise.all([
        fetchPromotionsDirect(),
        fetchPartnersDirect(),
        fetchHomeSettingsDirect(),
        fetchProductsDirect(HOME_FEATURED_PRODUCTS_OPTIONS),
        fetchProductsDirect(HOME_DISCOUNTED_PRODUCTS_OPTIONS),
    ]);

    queryClient.setQueryData(HOME_PROMOTIONS_QUERY_KEY, promotions);
    queryClient.setQueryData(HOME_PARTNERS_QUERY_KEY, partners);
    queryClient.setQueryData(HOME_SETTINGS_QUERY_KEY, settings);
    queryClient.setQueryData(getHomeFeaturedProductsQueryOptions().queryKey, featured);
    queryClient.setQueryData(getHomeDiscountedProductsQueryOptions().queryKey, discounted);
    const jsonLd = JSON.stringify(buildHomeStructuredData()).replace(/</g, "\\u003c");

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: jsonLd }}
            />
            <HydrationBoundary state={dehydrate(queryClient)}>
                <HomePageClient />
            </HydrationBoundary>
        </>
    );
}
