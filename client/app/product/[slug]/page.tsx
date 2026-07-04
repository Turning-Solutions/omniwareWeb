import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import ProductPageClient from "./ProductPageClient";
import { fetchProductBySlugDirect } from "@/lib/server/homeData";
import { ensureDb } from "@/server/src/config/db";
import Product from "@/server/src/models/Product";
import {
    buildProductMetadata,
    buildProductStructuredData,
    type SeoProduct,
} from "@/lib/seo/productSeo";
import { fetchProductReviewSummary } from "@/lib/server/productReviewSummary";

/**
 * ISR: product pages are statically cached and revalidated every 2 minutes,
 * or instantly when admin edits the product via on-demand revalidation.
 */
export const revalidate = 120;

interface ProductPageProps {
    params: Promise<{ slug: string }>;
}

type ProductStaticParamDocument = {
    slug?: string;
};

export async function generateStaticParams() {
    await ensureDb();
    const products = await Product.find({
        isActive: true,
        slug: { $type: "string", $ne: "" },
        "seo.noIndex": { $ne: true },
        $or: [
            { isFeatured: true },
            { discountPercent: { $gt: 0 } },
        ],
    })
        .sort({ isFeatured: -1, discountPercent: -1, updatedAt: -1 })
        .limit(100)
        .select("slug")
        .lean<ProductStaticParamDocument[]>();

    return products.flatMap((product) =>
        product.slug ? [{ slug: product.slug }] : []
    );
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
    const { slug } = await params;
    const product = await fetchProductBySlugDirect(slug);

    if (!product) {
        return {
            title: "Product Not Found | Omniware",
            robots: { index: false, follow: false },
        };
    }

    return buildProductMetadata(product as SeoProduct);
}

export default async function ProductPage({ params }: ProductPageProps) {
    const { slug } = await params;

    // Direct MongoDB query — no HTTP loopback, no loading spinner.
    const product = await fetchProductBySlugDirect(slug);

    if (!product) notFound();
    if (product.slug && slug !== product.slug) {
        permanentRedirect(`/product/${encodeURIComponent(product.slug)}`);
    }

    const queryClient = new QueryClient();
    queryClient.setQueryData(["product", slug], product);
    const reviewSummary = await fetchProductReviewSummary(String(product._id ?? ""));
    const structuredData = buildProductStructuredData(product as SeoProduct, reviewSummary);
    const jsonLd = JSON.stringify([structuredData.product, structuredData.breadcrumbs]).replace(/</g, "\\u003c");

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: jsonLd }}
            />
            <HydrationBoundary state={dehydrate(queryClient)}>
                <ProductPageClient slug={slug} />
            </HydrationBoundary>
        </>
    );
}
