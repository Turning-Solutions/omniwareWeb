import { NextResponse, type NextRequest } from "next/server";
import { hasShopListingParams } from "@/lib/shopUrlFilters";
import { ensureDb } from "@/server/src/config/db";
import { isObjectIdString } from "@/server/src/utils/productSlug";
import Product from "@/server/src/models/Product";
import Category from "@/server/src/models/Category";

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
 * Next.js 16's Cache Components stream a static shell for every dynamic route
 * before the page's own data fetch resolves, so a `notFound()` thrown from
 * anywhere in `/product/[slug]` or `/shop/[categorySlug]`'s render tree — page
 * or layout — only ever produces a 200: the response status is already
 * committed by the time the check runs. Confirmed in production (curl showed
 * 200 for fake slugs even with a layout-level guard and no `loading.tsx` at
 * all). Next's own docs say the fix is to check here, before rendering starts,
 * and hand back a real 404 ourselves:
 * https://nextjs.org/docs/app/api-reference/file-conventions/loading#status-codes
 */
function notFoundResponse(): NextResponse {
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Not Found | Omniware</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#0a0a0a; color:#F1F1F1; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; text-align:center; }
  .wrap { padding:2rem; }
  h1 { font-size:1.5rem; margin:0 0 .75rem; }
  p { color:#B0B0B0; margin:0 0 1.5rem; }
  a { color:#F1F1F1; background:#D12B28; padding:.6rem 1.25rem; border-radius:.75rem; text-decoration:none; font-weight:600; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Page not found</h1>
    <p>That product or category isn't available anymore.</p>
    <a href="/shop">Browse the shop</a>
  </div>
</body>
</html>`;
    return new NextResponse(html, {
        status: 404,
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "X-Robots-Tag": "noindex",
        },
    });
}

async function productSlugExists(slug: string): Promise<boolean> {
    await ensureDb();
    const query = isObjectIdString(slug)
        ? { _id: slug, isActive: true }
        : { slug, isActive: true };
    return (await Product.exists(query)) != null;
}

async function categorySlugExists(categorySlug: string): Promise<boolean> {
    await ensureDb();
    const slug = decodeURIComponent(categorySlug).trim().toLowerCase();
    return (await Category.exists({ slug, isActive: true })) != null;
}

async function handleProduct(request: NextRequest) {
    const slug = decodeURIComponent(request.nextUrl.pathname.slice("/product/".length));
    if (!slug) return NextResponse.next();

    try {
        if (!(await productSlugExists(slug))) return notFoundResponse();
    } catch (error) {
        // Fail open — a DB hiccup here must never take down real product pages.
        console.error("[proxy] product existence check failed:", error);
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
async function handleShop(request: NextRequest, landingPath: string, categorySlug?: string) {
    if (categorySlug) {
        try {
            if (!(await categorySlugExists(categorySlug))) return notFoundResponse();
        } catch (error) {
            console.error("[proxy] category existence check failed:", error);
        }
    }
    if (hasShopListingParams(request.nextUrl.searchParams)) {
        return NextResponse.next();
    }
    return NextResponse.rewrite(new URL(landingPath, request.url));
}

export default async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    if (pathname === "/shop") return handleShop(request, "/shop-all");

    // `/shop/{categorySlug}` — same treatment. The matcher below keeps this to a
    // single segment, so deeper paths never reach here.
    if (pathname.startsWith("/shop/")) {
        const categorySlug = pathname.slice("/shop/".length);
        return handleShop(request, `/shop-all/${categorySlug}`, categorySlug);
    }

    if (pathname.startsWith("/product/")) {
        return handleProduct(request);
    }

    return handleHomepage(request);
}

export const config = {
    matcher: ["/", "/shop", "/shop/:categorySlug", "/product/:slug"],
};
