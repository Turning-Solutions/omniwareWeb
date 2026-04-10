import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
