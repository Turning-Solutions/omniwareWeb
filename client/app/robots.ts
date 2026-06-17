import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/productSeo";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();

    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/admin/",
                "/account/",
                "/api/",
                "/cart",
                "/checkout",
                "/login",
                "/register",
            ],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
        host: siteUrl,
    };
}
