import type { Metadata } from "next";
import {
    absoluteUrl,
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_IMAGE_HEIGHT,
    DEFAULT_OG_IMAGE_WIDTH,
    SITE_NAME,
} from "@/lib/seo/productSeo";
import { ensureDb } from "@/server/src/config/db";
import Category from "@/server/src/models/Category";
import "@/server/src/models/Brand";

type CategorySeoDocument = {
    name?: string;
    slug?: string;
    updatedAt?: Date;
};

export function normalizeCategorySlug(value: string): string {
    return decodeURIComponent(value).trim().toLowerCase();
}

export function titleFromSlug(slug: string): string {
    return slug
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

async function fetchCategorySeoBySlug(slug: string): Promise<CategorySeoDocument | null> {
    await ensureDb();
    const category = await Category.findOne({ slug, isActive: true })
        .select("name slug updatedAt")
        .lean();
    return category as CategorySeoDocument | null;
}

/**
 * Shared by the dynamic `/shop/[categorySlug]` route and the prerendered
 * `/shop-all/[categorySlug]` it is rewritten to. The canonical always points at
 * `/shop/{slug}` so the rewrite target never competes for the same listing.
 */
export async function buildCategoryShopMetadata(categorySlug: string): Promise<Metadata> {
    const normalizedSlug = normalizeCategorySlug(categorySlug);
    const category = await fetchCategorySeoBySlug(normalizedSlug);
    const categoryName = category?.name?.trim() || titleFromSlug(normalizedSlug) || "PC Components";
    const canonicalPath = `/shop/${encodeURIComponent(category?.slug || normalizedSlug)}`;
    const canonicalUrl = absoluteUrl(canonicalPath);
    const title = `${categoryName} Price in Sri Lanka | Omniware`;
    const description =
        `Buy ${categoryName} in Sri Lanka from Omniware. Compare latest PC components, prices, availability, and local warranty options.`;
    const imageUrl = absoluteUrl(DEFAULT_OG_IMAGE);

    return {
        title,
        description,
        keywords: [
            `${categoryName} Sri Lanka`,
            `${categoryName} price in Sri Lanka`,
            `buy ${categoryName} Sri Lanka`,
            "PC components Sri Lanka",
            "Omniware",
        ],
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            type: "website",
            locale: "en_LK",
            siteName: SITE_NAME,
            title,
            description,
            url: canonicalUrl,
            images: [{
                url: imageUrl,
                alt: `${categoryName} available from Omniware Sri Lanka`,
                width: DEFAULT_OG_IMAGE_WIDTH,
                height: DEFAULT_OG_IMAGE_HEIGHT,
            }],
        },
        twitter: {
            card: "summary_large_image",
            title,
            description,
            images: [imageUrl],
        },
    };
}

/** Active category slugs, for the prerendered listing route's `generateStaticParams`. */
export async function activeCategorySlugParams(): Promise<{ categorySlug: string }[]> {
    await ensureDb();
    const categories = await Category.find({
        isActive: true,
        slug: { $type: "string", $ne: "" },
    })
        .select("slug")
        .lean<CategorySeoDocument[]>();

    return categories.flatMap((category) =>
        category.slug ? [{ categorySlug: category.slug }] : []
    );
}
