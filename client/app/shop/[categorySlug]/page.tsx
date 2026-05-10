import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import CategoryShopPageClient from "./CategoryShopPageClient";
import {
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";
import { parseShopFiltersFromRouter } from "@/lib/shopUrlFilters";

/** ISR: category shop pages are edge-cached and revalidated. */
export const revalidate = 60;

interface CategoryShopPageProps {
    params: Promise<{
        categorySlug: string;
    }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CategoryShopPage({ params, searchParams }: CategoryShopPageProps) {
    const { categorySlug } = await params;
    const normalizedSlug = decodeURIComponent(categorySlug).trim().toLowerCase();
    const sp = searchParams ? await searchParams : {};
    const pathname = `/shop/${encodeURIComponent(normalizedSlug)}`;
    const parsed = parseShopFiltersFromRouter(pathname, sp);

    const queryClient = new QueryClient();
    const listOptions = shopProductsListQueryOptionsForHydration(parsed);
    await prefetchShopProductsList(queryClient, listOptions);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <CategoryShopPageClient normalizedSlug={normalizedSlug} initialFilters={parsed} />
        </HydrationBoundary>
    );
}
