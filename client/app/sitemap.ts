import type { MetadataRoute } from "next";
import { ensureDb } from "@/server/src/config/db";
import Product from "@/server/src/models/Product";
import Category from "@/server/src/models/Category";
import { absoluteUrl, getProductPath, getSiteUrl } from "@/lib/seo/productSeo";
import { getProductSlug, isObjectIdString } from "@/server/src/utils/productSlug";

// Always read live product/category URLs from MongoDB instead of a stale build snapshot.
export const dynamic = "force-dynamic";

type SitemapProduct = {
    slug?: string;
    _id?: unknown;
    updatedAt?: Date;
};

type SitemapCategory = {
    slug?: string;
    updatedAt?: Date;
};

function buildStaticRoutes(siteUrl: string): MetadataRoute.Sitemap {
    return [
        { url: siteUrl, changeFrequency: "weekly", priority: 1 },
        { url: `${siteUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
        { url: `${siteUrl}/build`, changeFrequency: "monthly", priority: 0.7 },
        { url: `${siteUrl}/services`, changeFrequency: "monthly", priority: 0.6 },
        { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
        { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
        { url: `${siteUrl}/pickup-and-delivery`, changeFrequency: "monthly", priority: 0.5 },
        { url: `${siteUrl}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.3 },
        { url: `${siteUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const siteUrl = getSiteUrl();
    const staticRoutes = buildStaticRoutes(siteUrl);

    try {
        await ensureDb();

        const [products, categories] = await Promise.all([
            // Only active, indexable products belong in the sitemap.
            // Inactive products still get SEO slugs via backfill for clean admin URLs.
            Product.find({
                isActive: true,
                "seo.noIndex": { $ne: true },
            })
                .select("slug updatedAt")
                .sort({ updatedAt: -1 })
                .lean<SitemapProduct[]>(),
            Category.find({
                isActive: true,
                slug: { $exists: true, $nin: [null, ""] },
            })
                .select("slug updatedAt")
                .sort({ updatedAt: -1 })
                .lean<SitemapCategory[]>(),
        ]);

        const categoryRoutes: MetadataRoute.Sitemap = categories.flatMap((category) =>
            category.slug
                ? [{
                    url: `${siteUrl}/shop/${encodeURIComponent(category.slug)}`,
                    lastModified: category.updatedAt,
                    changeFrequency: "daily" as const,
                    priority: 0.8,
                }]
                : []
        );

        const productRoutes: MetadataRoute.Sitemap = products.flatMap((product) => {
            const slug = getProductSlug(product);
            if (!slug || isObjectIdString(slug)) return [];

            const path = getProductPath({ slug });
            if (!path) return [];

            return [{
                url: absoluteUrl(path),
                lastModified: product.updatedAt,
                changeFrequency: "daily" as const,
                priority: 0.8,
            }];
        });

        return [...staticRoutes, ...categoryRoutes, ...productRoutes];
    } catch (error) {
        console.error("[sitemap] Failed to load product/category URLs:", error);
        return staticRoutes;
    }
}
