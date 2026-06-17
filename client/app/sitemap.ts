import type { MetadataRoute } from "next";
import { ensureDb } from "@/server/src/config/db";
import Product from "@/server/src/models/Product";
import Category from "@/server/src/models/Category";
import { getSiteUrl } from "@/lib/seo/productSeo";

export const revalidate = 300;

type SitemapDocument = {
    slug?: string;
    updatedAt?: Date;
    seo?: { noIndex?: boolean };
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    await ensureDb();

    const [products, categories] = await Promise.all([
        Product.find({
            isActive: true,
            slug: { $type: "string", $ne: "" },
            "seo.noIndex": { $ne: true },
        })
            .sort({ updatedAt: -1 })
            .select("slug updatedAt")
            .lean<SitemapDocument[]>(),
        Category.find({
            isActive: true,
            slug: { $type: "string", $ne: "" },
        })
            .sort({ updatedAt: -1 })
            .select("slug updatedAt")
            .lean<SitemapDocument[]>(),
    ]);

    const siteUrl = getSiteUrl();
    const staticRoutes: MetadataRoute.Sitemap = [
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
    const productRoutes: MetadataRoute.Sitemap = products.flatMap((product) =>
        product.slug
            ? [{
                url: `${siteUrl}/product/${encodeURIComponent(product.slug)}`,
                lastModified: product.updatedAt,
                changeFrequency: "daily" as const,
                priority: 0.8,
            }]
            : []
    );

    return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
