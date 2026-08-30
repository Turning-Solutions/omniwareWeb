import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The pre-migration WordPress site used /products/{slug}/ (plural).
      // Slugs were regenerated for the new catalog, so there's no reliable
      // 1:1 mapping to today's /product/{slug} (singular) URLs — but Google
      // still has thousands of the old URLs indexed. Sending them to /shop
      // instead of a bare 404 recovers some of that crawl equity and gives
      // anyone following an old link/bookmark a live page instead of a dead
      // end, per Google's own guidance for un-mappable URL migrations.
      {
        source: "/products/:slug*",
        destination: "/shop",
        permanent: true,
      },
    ];
  },
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  outputFileTracingIncludes: {
    "/api/internal/google-reviews-refresh": [
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "http", hostname: "res.cloudinary.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
