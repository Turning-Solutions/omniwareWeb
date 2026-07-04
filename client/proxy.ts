import { NextResponse, type NextRequest } from "next/server";

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
export default function proxy(request: NextRequest) {
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

export const config = {
    matcher: "/",
};
