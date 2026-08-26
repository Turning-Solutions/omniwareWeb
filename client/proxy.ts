import { NextResponse, type NextRequest } from "next/server";
import { hasShopListingParams } from "@/lib/shopUrlFilters";

/**
 * The old WordPress site was hit with search-spam backlinks pointing at
 * tens of thousands of junk URLs like /?s=23813137927601, which Google
 * indexed. Serving 410 Gone tells Google to drop them permanently — much
 * stronger than noindex and skips rendering the homepage for every spam
 * crawl. robots.txt must NOT block ?s= URLs, otherwise crawlers can never
 * see this response and the zombie URLs stay indexed forever.
 *
 * Only the homepage is affected: shop pages intentionally accept ?s= as a
 * legacy search alias (noindex + 404 when there are no results).
 */
function handleHomepage(request: NextRequest) {
    if (request.nextUrl.searchParams.has("s")) {
        return new NextResponse("Gone", {
            status: 410,
            headers: {
                "Content-Type": "text/plain",
                "X-Robots-Tag": "noindex",
            },
        });
    }
    return NextResponse.next();
}

/**
 * `/shop` and `/shop/{category}` await `searchParams`, so Next always renders them
 * dynamically — no edge cache, a full server render for every visitor. The
 * unfiltered listing is identical for everyone though, so send it to the
 * prerendered `/shop-all` twin instead and let Vercel serve it from the CDN.
 *
 * Anything carrying a filter param falls through to the dynamic route, which is
 * correct: those URLs are per-visitor and rendered per request. Filter clicks in
 * the UI never reach here at all — `ShopContent` syncs the URL with
 * `history.replaceState`, not an App Router navigation.
 *
 * The rewrite drops the query string on purpose: the landing ignores it, and a
 * clean target keeps every request on one CDN cache entry rather than one per
 * `utm_*` combination. The browser URL is untouched, so client code still reads
 * the original params off `window.location`.
 */
function handleShop(request: NextRequest, landingPath: string) {
    if (hasShopListingParams(request.nextUrl.searchParams)) {
        return NextResponse.next();
    }
    return NextResponse.rewrite(new URL(landingPath, request.url));
}

export default function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    if (pathname === "/shop") return handleShop(request, "/shop-all");

    // `/shop/{categorySlug}` — same treatment. The matcher below keeps this to a
    // single segment, so deeper paths never reach here.
    if (pathname.startsWith("/shop/")) {
        return handleShop(request, `/shop-all/${pathname.slice("/shop/".length)}`);
    }

    return handleHomepage(request);
}

export const config = {
    matcher: ["/", "/shop", "/shop/:categorySlug"],
};
