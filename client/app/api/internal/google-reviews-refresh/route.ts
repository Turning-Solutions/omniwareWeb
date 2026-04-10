import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";
import {
    DEFAULT_SOURCE_URL,
    importGoogleReviewPayload,
    scrapeGoogleMapsReviews,
} from "@/lib/server/googleMapsReviewScraper.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const INTERNAL_SECRET_HEADER = "x-google-reviews-internal-secret";

type RefreshRequestBody = {
    sourceUrl?: string;
    importUrl?: string;
    importSecret?: string;
    maxReviews?: number;
};

async function launchBrowserForRuntime() {
    if (!process.env.VERCEL) {
        const { chromium: localChromium } = await import("playwright");
        return localChromium.launch({ headless: true });
    }

    let executablePath = "";
    try {
        executablePath = await chromium.executablePath();
    } catch {
        executablePath = await chromium.executablePath(undefined);
    }

    return playwrightChromium.launch({
        args: chromium.args,
        executablePath,
        headless: true,
    });
}

function normalizedMaxReviews(input: unknown): number {
    const fromBody = Number(input);
    if (Number.isFinite(fromBody)) return Math.max(1, Math.min(500, Math.round(fromBody)));
    const fromEnv = Number(process.env.GOOGLE_REVIEWS_MAX_REVIEWS);
    if (Number.isFinite(fromEnv)) return Math.max(1, Math.min(500, Math.round(fromEnv)));
    return 120;
}

export async function POST(req: NextRequest) {
    const configuredSecret = process.env.GOOGLE_REVIEWS_INTERNAL_REFRESH_SECRET?.trim();
    const providedSecret = req.headers.get(INTERNAL_SECRET_HEADER)?.trim() || "";

    if (!configuredSecret) {
        return NextResponse.json(
            { message: "GOOGLE_REVIEWS_INTERNAL_REFRESH_SECRET is not configured." },
            { status: 503 }
        );
    }
    if (!providedSecret || providedSecret !== configuredSecret) {
        return NextResponse.json({ message: "Invalid internal refresh secret." }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as RefreshRequestBody;
    const importUrl = String(body.importUrl || "").trim();
    const importSecret = String(body.importSecret || "").trim();
    const sourceUrl = String(body.sourceUrl || process.env.GOOGLE_REVIEWS_SOURCE_URL || DEFAULT_SOURCE_URL).trim();
    const maxReviews = normalizedMaxReviews(body.maxReviews);

    if (!importUrl) {
        return NextResponse.json({ message: "importUrl is required." }, { status: 400 });
    }
    if (!importSecret) {
        return NextResponse.json({ message: "importSecret is required." }, { status: 400 });
    }

    try {
        const payload = await scrapeGoogleMapsReviews({
            sourceUrl,
            maxReviews,
            launchBrowser: launchBrowserForRuntime,
        });

        await importGoogleReviewPayload(importUrl, importSecret, payload);

        return NextResponse.json({
            ok: true,
            refreshed: true,
            total: payload.total,
            sourceUrl: payload.sourceUrl,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to refresh Google reviews.";
        return NextResponse.json({ message }, { status: 500 });
    }
}
