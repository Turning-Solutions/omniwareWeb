import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import ProductPageClient from "./ProductPageClient";
import { fetchProductBySlugDirect } from "@/lib/server/homeData";

/**
 * ISR: product pages are statically cached and revalidated every 2 minutes,
 * or instantly when admin edits the product via on-demand revalidation.
 */
export const revalidate = 120;

interface ProductPageProps {
    params: Promise<{ slug: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;

    // Direct MongoDB query — no HTTP loopback, no loading spinner.
    const product = await fetchProductBySlugDirect(slug);

    if (!product) notFound();

    const queryClient = new QueryClient();
    queryClient.setQueryData(["product", slug], product);

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProductPageClient slug={slug} />
        </HydrationBoundary>
    );
}
