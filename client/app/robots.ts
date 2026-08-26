import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/productSeo";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = getSiteUrl();

    return {
        rules: {
            userAgent: "*",
            allow: "/",
            // NOTE: ?s= spam URLs are intentionally NOT disallowed here.
            // The proxy serves them a 410, and Google must be able to crawl
            // them to see it — blocking them would keep them indexed forever.
            disallow: [
                // Internal rewrite target for the unfiltered /shop landing. Crawlers
                // request /shop (allowed) and this rule never affects that; it only
                // stops /shop-all being indexed as a duplicate if it is found directly.
                "/shop-all",
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
