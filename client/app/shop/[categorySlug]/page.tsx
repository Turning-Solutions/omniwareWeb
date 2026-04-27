import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import CategoryShopPageClient from "./CategoryShopPageClient";
import {
    prefetchShopProductsList,
    shopProductsListQueryOptionsForHydration,
} from "@/lib/shopInitialProductsFetch";

interface CategoryShopPageProps {
    params: Promise<{
        categorySlug: string;
    }>;
}

export default async function CategoryShopPage({ params }: CategoryShopPageProps) {
    const { categorySlug } = await params;
    const normalizedSlug = decodeURIComponent(categorySlug).trim().toLowerCase();

    const queryClient = new QueryClient();
    const listOptions = shopProductsListQueryOptionsForHydration({ category: normalizedSlug });
    await prefetchShopProductsList(queryClient, listOptions);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <CategoryShopPageClient normalizedSlug={normalizedSlug} />
        </HydrationBoundary>
    );
}
