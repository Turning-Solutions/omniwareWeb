import { QueryClient } from "@tanstack/react-query";
import { headers } from "next/headers";
import { HOME_PROMOTIONS_QUERY_KEY, type HomePromotion } from "@/lib/homePromotionsQuery";
import { fetchShopProductsJson } from "@/lib/shopInitialProductsFetch";
import { getHomeFeaturedProductsQueryOptions, HOME_FEATURED_PRODUCTS_OPTIONS } from "@/lib/homeFeaturedProductsQuery";
import { getHomeDiscountedProductsQueryOptions, HOME_DISCOUNTED_PRODUCTS_OPTIONS } from "@/lib/homeDiscountedProductsQuery";
import { FALLBACK_TOP_BRANDS, HOME_PARTNERS_QUERY_KEY, type PartnerBrand } from "@/lib/homePartnersQuery";
import { getHomeSettingsQueryOptions } from "@/lib/homeSettingsQuery";

const PROMOTIONS_REVALIDATE_SECONDS = 60;

async function resolveServerApiBaseUrl(): Promise<string> {
    const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
    if (raw && /^https?:\/\//i.test(raw)) {
        return raw.replace(/\/+$/, "");
    }
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`.replace(/\/+$/, "");
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) return (vercel.startsWith("http") ? vercel : `https://${vercel}`).replace(/\/+$/, "");
    const port = process.env.PORT ?? "3000";
    return `http://127.0.0.1:${port}`;
}

export async function fetchHomePromotionsJson(): Promise<HomePromotion[]> {
    const base = await resolveServerApiBaseUrl();
    const url = `${base}/api/v1/promotions/active`;
    const res = await fetch(url, {
        next: { revalidate: PROMOTIONS_REVALIDATE_SECONDS },
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        return [];
    }
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as HomePromotion[]) : [];
}

export async function prefetchHomePromotions(queryClient: QueryClient): Promise<void> {
    await queryClient.prefetchQuery({
        queryKey: HOME_PROMOTIONS_QUERY_KEY,
        queryFn: fetchHomePromotionsJson,
        staleTime: 20 * 60 * 1000,
    });
}

export async function prefetchHomeFeaturedProducts(queryClient: QueryClient): Promise<void> {
    await queryClient.prefetchQuery({
        ...getHomeFeaturedProductsQueryOptions(),
        queryFn: () => fetchShopProductsJson(HOME_FEATURED_PRODUCTS_OPTIONS),
        staleTime: 2 * 60 * 1000,
    });
}

export async function prefetchHomeDiscountedProducts(queryClient: QueryClient): Promise<void> {
    await queryClient.prefetchQuery({
        ...getHomeDiscountedProductsQueryOptions(),
        queryFn: () => fetchShopProductsJson(HOME_DISCOUNTED_PRODUCTS_OPTIONS),
        staleTime: 2 * 60 * 1000,
    });
}

export async function fetchHomePartnersJson(): Promise<PartnerBrand[]> {
    const base = await resolveServerApiBaseUrl();
    const url = `${base}/api/v1/partners/active`;
    const res = await fetch(url, {
        next: { revalidate: 300 },
        headers: { Accept: "application/json" },
    });
    if (!res.ok) return FALLBACK_TOP_BRANDS;
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as PartnerBrand[]) : FALLBACK_TOP_BRANDS;
}

export async function prefetchHomePartners(queryClient: QueryClient): Promise<void> {
    await queryClient.prefetchQuery({
        queryKey: HOME_PARTNERS_QUERY_KEY,
        queryFn: fetchHomePartnersJson,
        staleTime: 20 * 60 * 1000,
    });
}

export async function prefetchHomeSettings(queryClient: QueryClient): Promise<void> {
    await queryClient.prefetchQuery(getHomeSettingsQueryOptions());
}

