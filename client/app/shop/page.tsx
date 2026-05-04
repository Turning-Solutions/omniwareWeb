import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ShopPageClient from "./ShopPageClient";
import {
    prefetchShopFacets,
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";

function pickSearchParam(value: string | string[] | undefined): string {
    if (value == null) return "";
    const raw = Array.isArray(value) ? value[0] : value;
    return String(raw ?? "").trim();
}

interface ShopPageProps {
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShopPage({ searchParams }: ShopPageProps) {
    const sp = searchParams ? await searchParams : {};
    const initialSearch = pickSearchParam(sp.search ?? sp.q);

    const queryClient = new QueryClient();
    const listOptions = shopProductsListQueryOptionsForHydration({ search: initialSearch });
    const facetOptions = { search: initialSearch };
    await Promise.all([
        prefetchShopProductsList(queryClient, listOptions),
        prefetchShopFacets(queryClient, facetOptions),
    ]);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ShopPageClient initialSearch={initialSearch} />
        </HydrationBoundary>
    );
}
