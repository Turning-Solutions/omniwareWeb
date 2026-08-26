import type { Metadata } from "next";
import {
    absoluteUrl,
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_IMAGE_HEIGHT,
    DEFAULT_OG_IMAGE_WIDTH,
    SITE_NAME,
} from "@/lib/seo/productSeo";

export const shopTitle = "Shop PC Components & Custom Builds in Sri Lanka | Omniware";
export const shopDescription =
    "Buy PC components, gaming hardware, accessories, and custom PC builds in Sri Lanka with local warranty support from Omniware.";
export const shopUrl = absoluteUrl("/shop");
const shopImageUrl = absoluteUrl(DEFAULT_OG_IMAGE);

/**
 * Shared by the dynamic `/shop` route and the prerendered landing that `/shop`
 * is rewritten to. The landing's HTML is what visitors and crawlers receive at
 * `/shop`, so this must stay indexable with the canonical pointing at `/shop` —
 * marking the landing `noindex` would deindex the shop itself.
 */
export const baseShopMetadata: Metadata = {
    title: shopTitle,
    description: shopDescription,
    keywords: [
        "PC components Sri Lanka",
        "custom PC builds Sri Lanka",
        "gaming PC Sri Lanka",
        "computer parts Sri Lanka",
        "buy PC parts Sri Lanka",
    ],
    alternates: {
        canonical: shopUrl,
    },
    openGraph: {
        type: "website",
        locale: "en_LK",
        siteName: SITE_NAME,
        title: shopTitle,
        description: shopDescription,
        url: shopUrl,
        images: [{
            url: shopImageUrl,
            alt: "Omniware PC components and custom builds in Sri Lanka",
            width: DEFAULT_OG_IMAGE_WIDTH,
            height: DEFAULT_OG_IMAGE_HEIGHT,
        }],
    },
    twitter: {
        card: "summary_large_image",
        title: shopTitle,
        description: shopDescription,
        images: [shopImageUrl],
    },
};
