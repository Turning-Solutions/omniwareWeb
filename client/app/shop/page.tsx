import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import ShopPageClient from "./ShopPageClient";
import {
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
    await prefetchShopProductsList(queryClient, listOptions);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ShopPageClient initialSearch={initialSearch} />
        </HydrationBoundary>
    );
}
