/**
 * Seeds the GoogleReviewFeed collection from the bundled static snapshot
 * (`client/data/shop-google-reviews.json`) so the live `/reviews/google`
 * endpoint returns Google reviews even before the scraper worker is wired up.
 *
 * The static snapshot only carries relative date labels ("3 months ago"), so we
 * approximate a real `createdAt` per review (anchored to the snapshot's `fetchedAt`)
 * for sensible ordering, while preserving the original `dateText` for display.
 *
 * Idempotent: importing replaces the feed contents each run (same externalIds → same hashes).
 *
 * Run:  npx ts-node src/scripts/seedGoogleReviews.ts
 * or:   npm run seed:google-reviews
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { importGoogleBusinessReviews, type GoogleReviewImportItem } from '../services/googleBusinessReviews';
import { expandMongoSrvUri } from '../utils/expandMongoSrvUri';

function loadEnv(): void {
    const here = __dirname;
    const candidates = [
        path.resolve(process.cwd(), '.env'),
        path.resolve(here, '../../.env'),
        path.resolve(here, '../../../client/.env'),
        path.resolve(here, '../../../.env'),
    ];
    for (const file of candidates) {
        if (fs.existsSync(file)) {
            dotenv.config({ path: file });
            console.log(`[seed:google-reviews] Loaded env from ${file}`);
            if (process.env.MONGODB_URI) return;
        }
    }
    dotenv.config();
}
loadEnv();

async function connect(): Promise<void> {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not set.');
    }
    let connectUri = process.env.MONGODB_URI;
    if (process.env.MONGODB_URI_DIRECT?.trim()) {
        connectUri = process.env.MONGODB_URI_DIRECT.trim();
    } else if (/^mongodb\+srv:\/\//i.test(process.env.MONGODB_URI)) {
        connectUri = await expandMongoSrvUri(process.env.MONGODB_URI);
    }
    await mongoose.connect(connectUri);
    console.log(`[seed:google-reviews] Connected to ${mongoose.connection.host}`);
}

const MS = {
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    year: 365 * 24 * 60 * 60 * 1000,
};

/**
 * Turns Google's relative label into an approximate absolute date, anchored to `baseMs`.
 * "3 months ago" -> baseMs - 3*month. Unparseable labels return null.
 */
function approxDateFromRelative(dateText: string, baseMs: number): Date | null {
    const cleaned = dateText.toLowerCase().replace(/^edited\s+/, '').trim();
    const match = cleaned.match(/(a|an|\d+)\s+(day|week|month|year)s?\s+ago/);
    if (!match) return null;
    const count = match[1] === 'a' || match[1] === 'an' ? 1 : Number(match[1]);
    const unit = match[2] as keyof typeof MS;
    if (!Number.isFinite(count)) return null;
    return new Date(baseMs - count * MS[unit]);
}

type StaticReview = {
    id: string;
    authorName: string;
    rating: number;
    dateText?: string;
    comment: string;
};

type StaticFile = {
    sourceUrl?: string;
    fetchedAt?: string;
    reviews?: StaticReview[];
};

async function main(): Promise<void> {
    const jsonPath = path.resolve(__dirname, '../../../client/data/shop-google-reviews.json');
    if (!fs.existsSync(jsonPath)) {
        throw new Error(`Static snapshot not found at ${jsonPath}`);
    }

    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as StaticFile;
    const staticReviews = Array.isArray(raw.reviews) ? raw.reviews : [];
    if (staticReviews.length === 0) {
        throw new Error('Static snapshot has no reviews to seed.');
    }

    const baseTs = Date.parse(raw.fetchedAt ?? '');
    const baseMs = Number.isNaN(baseTs) ? Date.now() : baseTs;

    const items: GoogleReviewImportItem[] = staticReviews.map((r, index) => {
        const dateText = String(r.dateText ?? '').trim();
        // Fall back to a stable day-staggered date so ordering stays deterministic
        // even when a label can't be parsed.
        const createdAt =
            (dateText ? approxDateFromRelative(dateText, baseMs) : null) ??
            new Date(baseMs - index * MS.day);
        return {
            externalId: r.id,
            authorName: r.authorName,
            rating: r.rating,
            comment: r.comment,
            dateText,
            createdAt: createdAt.toISOString(),
        };
    });

    await connect();

    const status = await importGoogleBusinessReviews({
        sourceUrl: raw.sourceUrl,
        reviews: items,
    });

    console.log(`[seed:google-reviews] Imported ${status.reviewCount} reviews.`);
    console.log(`[seed:google-reviews] Feed status: ${status.lastImportStatus}, synced ${status.lastSyncedAt}`);

    await mongoose.disconnect();
    console.log('[seed:google-reviews] Done.');
}

main().catch(async (err) => {
    console.error('[seed:google-reviews] FAILED:', err);
    try {
        await mongoose.disconnect();
    } catch {
        // ignore
    }
    process.exit(1);
});
