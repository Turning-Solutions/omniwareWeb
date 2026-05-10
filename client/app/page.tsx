import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import HomePageClient from "./HomePageClient";
import {
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

/**
 * ISR: serve a cached static page and revalidate in the background at most
 * every 60 s.  Admin mutations call /api/internal/revalidate for instant refresh.
 */
export const revalidate = 60;

export default async function HomePage() {
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

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <HomePageClient />
        </HydrationBoundary>
    );
}
