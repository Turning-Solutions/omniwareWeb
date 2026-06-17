import type { Metadata } from "next";
import AboutPageClient from "./AboutPageClient";
import {
    absoluteUrl,
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_IMAGE_HEIGHT,
    DEFAULT_OG_IMAGE_WIDTH,
    SITE_NAME,
} from "@/lib/seo/productSeo";

const aboutTitle = "About Omniware | Custom PC Builders in Sri Lanka";
const aboutDescription =
    "Meet Omniware, Sri Lanka's custom PC builders and high-end computer component specialists focused on practical advice, clean builds, and after-sales support.";
const aboutUrl = absoluteUrl("/about");
const aboutImageUrl = absoluteUrl(DEFAULT_OG_IMAGE);

export const metadata: Metadata = {
    title: aboutTitle,
    description: aboutDescription,
    alternates: {
        canonical: aboutUrl,
    },
    openGraph: {
        type: "website",
        locale: "en_LK",
        siteName: SITE_NAME,
        title: aboutTitle,
        description: aboutDescription,
        url: aboutUrl,
        images: [{
            url: aboutImageUrl,
            alt: "Omniware custom PC builders in Sri Lanka",
            width: DEFAULT_OG_IMAGE_WIDTH,
            height: DEFAULT_OG_IMAGE_HEIGHT,
        }],
    },
    twitter: {
        card: "summary_large_image",
        title: aboutTitle,
        description: aboutDescription,
        images: [aboutImageUrl],
    },
};

export default function AboutPage() {
    return <AboutPageClient />;
}
