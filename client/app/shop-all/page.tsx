import type { Metadata } from "next";
import ShopLanding from "@/app/shop/ShopLanding";
import { baseShopMetadata } from "@/app/shop/shopMetadata";

/**
 * Prerendered shop landing — the internal rewrite target for `/shop` when the
 * request carries no filter params (see `proxy.ts`).
 *
 * `/shop` itself cannot be cached: it awaits `searchParams`, which forces dynamic
 * rendering, so Next sends `Cache-Control: private, no-cache, no-store` and every
 * visitor pays a full server render. This route touches no request-time API, so it
 * prerenders and Vercel serves it from the edge, revalidating every 60s.
 *
 * It is a real URL, so its metadata must be the genuine `/shop` metadata: the HTML
 * built here is what visitors and crawlers get at `/shop`. The canonical points at
 * `/shop`, which is what keeps `/shop-all` from being indexed as a duplicate.
 */
export const dynamic = "force-static";
export const revalidate = 60;

export const metadata: Metadata = baseShopMetadata;

export default async function ShopAllPage() {
    return <ShopLanding />;
}
