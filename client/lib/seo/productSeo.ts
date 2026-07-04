import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://www.omniware.lk";
export const SITE_NAME = "Omniware";
export const DEFAULT_OG_IMAGE = "/og-default.png";
export const SITE_BRAND_ICON = "/site-brand-icon.png";
export const SITE_FAVICON = "/brand-icon.png";
export const DEFAULT_OG_IMAGE_WIDTH = 1200;
export const DEFAULT_OG_IMAGE_HEIGHT = 630;

type NamedEntity = {
    name?: string;
    slug?: string;
};

type ProductSeoOverrides = {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
    imageAlt?: string;
    noIndex?: boolean;
};

export type SeoProduct = {
    _id?: string;
    slug?: string;
    title: string;
    description?: string;
    sku?: string;
    price: number;
    discountedPrice?: number | null;
    images?: string[];
    availability?: "in_stock" | "out_of_stock" | "pre_order" | "coming_soon";
    stock?: { qty?: number };
    warranty?: string;
    brand?: string | NamedEntity;
    brandId?: string | NamedEntity;
    categoryIds?: NamedEntity[];
    seo?: ProductSeoOverrides;
};

function clean(value: unknown): string {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) return value;
    const shortened = value.slice(0, maxLength - 1);
    const lastSpace = shortened.lastIndexOf(" ");
    return `${shortened.slice(0, lastSpace > maxLength * 0.65 ? lastSpace : -1).trim()}…`;
}

function getBrandName(product: SeoProduct): string {
    if (typeof product.brand === "string") return clean(product.brand);
    if (product.brand?.name) return clean(product.brand.name);
    if (typeof product.brandId !== "string" && product.brandId?.name) return clean(product.brandId.name);
    return "";
}

function getCategory(product: SeoProduct): NamedEntity | undefined {
    return product.categoryIds?.find((category) => clean(category.name));
}

function productIdString(value: unknown): string {
    if (typeof value === "string") {
        const id = value.trim();
        return /^[a-fA-F0-9]{24}$/.test(id) ? id : "";
    }
    if (value != null && typeof value === "object" && "toString" in value) {
        const id = String(value);
        return /^[a-fA-F0-9]{24}$/.test(id) ? id : "";
    }
    return "";
}

export function getProductPath(product: { slug?: string; _id?: unknown }): string | null {
    const segment = clean(product.slug) || productIdString(product._id);
    if (!segment) return null;
    return `/product/${encodeURIComponent(segment)}`;
}

export function absoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, getSiteUrl()).toString();
}

function formatLkr(value: number): string {
    return `LKR ${Math.round(value).toLocaleString("en-LK")}`;
}

function getEffectivePrice(product: SeoProduct): number {
    return typeof product.discountedPrice === "number" ? product.discountedPrice : product.price;
}

/**
 * The admin-chosen availability state is authoritative — pre-order products
 * must be announced to Google as PreOrder, not InStock, even when a stock
 * quantity is recorded. Stock qty is only a fallback when availability is
 * missing entirely.
 */
function resolveAvailability(product: SeoProduct): NonNullable<SeoProduct["availability"]> {
    if (product.availability) return product.availability;
    return (product.stock?.qty ?? 0) > 0 ? "in_stock" : "out_of_stock";
}

function availabilityLabel(product: SeoProduct): string {
    const availability = resolveAvailability(product);

    if (availability === "in_stock") return "in stock";
    if (availability === "pre_order") return "available for pre-order";
    if (availability === "coming_soon") return "coming soon";
    return "currently out of stock";
}

function schemaAvailability(product: SeoProduct): string {
    const availability = resolveAvailability(product);

    if (availability === "in_stock") return "https://schema.org/InStock";
    if (availability === "out_of_stock") return "https://schema.org/OutOfStock";
    return "https://schema.org/PreOrder";
}

function buildGeneratedTitle(product: SeoProduct): string {
    const productName = clean(product.title);
    const brand = getBrandName(product);
    const nameWithBrand =
        brand && !productName.toLowerCase().includes(brand.toLowerCase())
            ? `${brand} ${productName}`
            : productName;
    const suffix = " Price in Sri Lanka | Omniware";
    const maxNameLength = Math.max(25, 65 - suffix.length);
    return `${truncate(nameWithBrand, maxNameLength)}${suffix}`;
}

function buildGeneratedDescription(product: SeoProduct): string {
    const price = formatLkr(getEffectivePrice(product));
    const warranty = clean(product.warranty);
    const warrantyText = warranty ? `, ${warranty} warranty` : "";
    const description =
        `Buy ${clean(product.title)} in Sri Lanka for ${price}. ` +
        `${availabilityLabel(product)}${warrantyText}. View specifications and islandwide delivery options from Omniware.`;
    return truncate(description, 160);
}

function normalizeSiteUrl(candidate: string): string | null {
    try {
        const url = new URL(candidate);
        const host = url.hostname.toLowerCase();

        if (host.endsWith(".vercel.app") || host === "localhost" || host.startsWith("127.")) {
            return null;
        }

        if (host === "omniware.lk") {
            url.hostname = "www.omniware.lk";
        }

        return url.toString().replace(/\/+$/, "");
    } catch {
        return null;
    }
}

export function getSiteUrl(): string {
    const candidates = [
        process.env.SITE_URL?.trim(),
        process.env.NEXT_PUBLIC_SITE_URL?.trim(),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        const normalized = normalizeSiteUrl(candidate);
        if (normalized) return normalized;
    }

    return DEFAULT_SITE_URL;
}

export function buildProductSeo(product: SeoProduct) {
    const overrides = product.seo ?? {};
    const title = clean(overrides.title) || buildGeneratedTitle(product);
    const description = clean(overrides.description) || buildGeneratedDescription(product);
    const productPath = getProductPath(product) ?? `/product/${encodeURIComponent(clean(product._id))}`;
    const canonicalUrl = absoluteUrl(productPath);
    const image = clean(overrides.image) || clean(product.images?.[0]) || DEFAULT_OG_IMAGE;
    const imageUrl = absoluteUrl(image);
    const imageAlt = clean(overrides.imageAlt) || `${clean(product.title)} available in Sri Lanka`;
    const brand = getBrandName(product);
    const category = getCategory(product);
    const generatedKeywords = [
        clean(product.title),
        brand,
        category?.name ? `${clean(category.name)} Sri Lanka` : "",
        `${clean(product.title)} price in Sri Lanka`,
        `buy ${clean(product.title)} Sri Lanka`,
    ].filter(Boolean);
    const overrideKeywords = overrides.keywords?.map(clean).filter(Boolean) ?? [];
    const keywords = overrideKeywords.length > 0 ? overrideKeywords : generatedKeywords;

    return {
        title,
        description,
        canonicalUrl,
        productPath,
        imageUrl,
        imageAlt,
        brand,
        category,
        keywords: Array.from(new Set(keywords)),
        noIndex: overrides.noIndex === true,
    };
}

export function buildProductMetadata(product: SeoProduct): Metadata {
    const seo = buildProductSeo(product);

    return {
        title: seo.title,
        description: seo.description,
        keywords: seo.keywords,
        alternates: {
            canonical: seo.canonicalUrl,
        },
        robots: seo.noIndex
            ? { index: false, follow: false }
            : { index: true, follow: true },
        openGraph: {
            type: "website",
            locale: "en_LK",
            siteName: SITE_NAME,
            title: seo.title,
            description: seo.description,
            url: seo.canonicalUrl,
            images: [{
                url: seo.imageUrl,
                alt: seo.imageAlt,
                width: DEFAULT_OG_IMAGE_WIDTH,
                height: DEFAULT_OG_IMAGE_HEIGHT,
            }],
        },
        twitter: {
            card: "summary_large_image",
            title: seo.title,
            description: seo.description,
            images: [seo.imageUrl],
        },
    };
}

export type ProductReviewSummary = {
    ratingValue: number;
    reviewCount: number;
    reviews?: {
        author: string;
        rating: number;
        body?: string;
        datePublished?: string;
    }[];
};

/** Rolling 30-day price commitment; product pages revalidate every 2 minutes. */
function priceValidUntil(): string {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Islandwide courier: same-day dispatch for stocked items, 1-3 working days transit. */
const SHIPPING_DETAILS = {
    "@type": "OfferShippingDetails",
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "LK" },
    deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
    },
} as const;

export function buildProductStructuredData(product: SeoProduct, reviewSummary?: ProductReviewSummary) {
    const seo = buildProductSeo(product);
    const categoryUrl = seo.category?.slug
        ? absoluteUrl(`/shop/${encodeURIComponent(seo.category.slug)}`)
        : absoluteUrl("/shop");
    const breadcrumbs = [
        { name: "Home", url: getSiteUrl() },
        { name: seo.category?.name || "Shop", url: categoryUrl },
        { name: clean(product.title), url: seo.canonicalUrl },
    ];

    return {
        product: {
            "@context": "https://schema.org",
            "@type": "Product",
            name: clean(product.title),
            description: clean(product.description) || seo.description,
            image: (product.images?.length ? product.images : [seo.imageUrl]).map(absoluteUrl),
            url: seo.canonicalUrl,
            ...(clean(product.sku) ? { sku: clean(product.sku), mpn: clean(product.sku) } : {}),
            ...(seo.brand ? { brand: { "@type": "Brand", name: seo.brand } } : {}),
            ...(seo.category?.name ? { category: clean(seo.category.name) } : {}),
            ...(reviewSummary && reviewSummary.reviewCount > 0
                ? {
                    aggregateRating: {
                        "@type": "AggregateRating",
                        ratingValue: Math.round(reviewSummary.ratingValue * 10) / 10,
                        reviewCount: reviewSummary.reviewCount,
                        bestRating: 5,
                        worstRating: 1,
                    },
                    ...(reviewSummary.reviews?.length
                        ? {
                            review: reviewSummary.reviews.map((review) => ({
                                "@type": "Review",
                                author: { "@type": "Person", name: review.author },
                                reviewRating: {
                                    "@type": "Rating",
                                    ratingValue: review.rating,
                                    bestRating: 5,
                                    worstRating: 1,
                                },
                                ...(review.body ? { reviewBody: review.body } : {}),
                                ...(review.datePublished ? { datePublished: review.datePublished } : {}),
                            })),
                        }
                        : {}),
                }
                : {}),
            offers: {
                "@type": "Offer",
                url: seo.canonicalUrl,
                priceCurrency: "LKR",
                price: getEffectivePrice(product).toFixed(2),
                priceValidUntil: priceValidUntil(),
                availability: schemaAvailability(product),
                itemCondition: "https://schema.org/NewCondition",
                shippingDetails: SHIPPING_DETAILS,
                seller: {
                    "@type": "Organization",
                    name: SITE_NAME,
                    url: getSiteUrl(),
                },
            },
        },
        breadcrumbs: {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumbs.map((item, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: item.name,
                item: item.url,
            })),
        },
    };
}

type ItemListProduct = {
    _id?: unknown;
    slug?: string;
    title?: string;
};

/**
 * ItemList structured data for shop/category listing pages. Gives crawlers a
 * machine-readable list of product URLs even before the interactive grid
 * hydrates, which helps product page discovery and indexing.
 */
export function buildItemListStructuredData(params: {
    name: string;
    url: string;
    products: ItemListProduct[];
}) {
    const items = params.products.flatMap((product) => {
        const path = getProductPath(product);
        return path ? [{ path, name: clean(product.title) }] : [];
    });
    if (items.length === 0) return null;

    return {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: params.name,
        url: params.url,
        numberOfItems: items.length,
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            ...(item.name ? { name: item.name } : {}),
            url: absoluteUrl(item.path),
        })),
    };
}
