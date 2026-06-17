import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import AppChrome from "@/components/AppChrome";
import {
    absoluteUrl,
    DEFAULT_OG_IMAGE,
    DEFAULT_OG_IMAGE_HEIGHT,
    DEFAULT_OG_IMAGE_WIDTH,
    getSiteUrl,
    SITE_FAVICON,
    SITE_NAME,
} from "@/lib/seo/productSeo";

const inter = Inter({ subsets: ["latin"] });
const defaultTitle = "Omniware.lk | Custom PC Builds & Components in Sri Lanka";
const defaultDescription =
    "Custom PC builds, gaming PCs, computer components, and accessories in Sri Lanka. Shop selected hardware with local warranty support from Omniware.";
const defaultOgImage = absoluteUrl(DEFAULT_OG_IMAGE);

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    title: {
        default: defaultTitle,
        template: "%s",
    },
    description: defaultDescription,
    openGraph: {
        type: "website",
        locale: "en_LK",
        siteName: SITE_NAME,
        title: defaultTitle,
        description: defaultDescription,
        images: [{
            url: defaultOgImage,
            alt: "Omniware custom PC builds and components in Sri Lanka",
            width: DEFAULT_OG_IMAGE_WIDTH,
            height: DEFAULT_OG_IMAGE_HEIGHT,
        }],
    },
    twitter: {
        card: "summary_large_image",
        title: defaultTitle,
        description: defaultDescription,
        images: [defaultOgImage],
    },
    icons: {
        icon: [
            { url: SITE_FAVICON, sizes: "48x48", type: "image/png" },
        ],
        apple: "/apple-touch-icon.png",
        shortcut: SITE_FAVICON,
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en-LK" className="dark">
            <body className={`${inter.className} min-h-screen flex flex-col bg-background text-foreground`}>
                <Providers>
                    <AppChrome>{children}</AppChrome>
                </Providers>
            </body>
        </html>
    );
}
