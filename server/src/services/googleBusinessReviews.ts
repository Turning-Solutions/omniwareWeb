import crypto from 'crypto';
import GoogleReviewFeed from '../models/GoogleReviewFeed';

export type GoogleReviewForClient = {
    _id: string;
    kind: 'shop';
    productId?: null;
    rating: number;
    authorName: string;
    comment: string;
    createdAt: string;
    source: 'google';
};

export type GoogleReviewImportItem = {
    id?: string;
    externalId?: string;
    authorName?: string;
    rating?: number;
    comment?: string;
    dateText?: string;
    createdAt?: string;
};

export type GoogleReviewImportPayload = {
    sourceUrl?: string;
    reviews?: GoogleReviewImportItem[];
};

export type GoogleReviewSyncStatus = {
    sourceUrl: string;
    reviewCount: number;
    lastRequestedAt: string | null;
    lastSyncedAt: string | null;
    lastImportStatus: 'idle' | 'pending' | 'success' | 'error';
    lastError: string;
    lastRequestedBy: string;
};

const FEED_KEY = 'omniware-google-maps';
export const DEFAULT_GOOGLE_MAPS_URL =
    'https://www.google.com/maps/place/Omniware+Technologies/@6.8499418,79.8840428,17z/data=!4m8!3m7!1s0x3ae25bc001c21cfb:0x706552a0c455e4a3!8m2!3d6.8499365!4d79.8866177!9m1!1b1!16s%2Fg%2F11srgk22h7?entry=ttu&g_ep=EgoyMDI2MDQwNy4wIKXMDSoASAFQAw%3D%3D';

function configuredSourceUrl(): string {
    return process.env.GOOGLE_REVIEWS_SOURCE_URL?.trim() || DEFAULT_GOOGLE_MAPS_URL;
}

function reviewHash(...parts: string[]): string {
    return crypto.createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 24);
}

function clampRating(input: unknown): number {
    const raw = Number(input);
    if (!Number.isFinite(raw)) return 5;
    return Math.max(1, Math.min(5, Math.round(raw)));
}

function safeDate(input: unknown): Date {
    const d = input ? new Date(String(input)) : new Date(0);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function trimText(input: unknown, fallback: string, max: number): string {
    const s = String(input ?? '').trim();
    return (s || fallback).slice(0, max);
}

function mapStoredReview(r: {
    externalId?: string;
    authorName?: string;
    rating?: number;
    comment?: string;
    createdAt?: Date | string;
}): GoogleReviewForClient {
    const createdAt = safeDate(r.createdAt).toISOString();
    const authorName = trimText(r.authorName, 'Google user', 100);
    const comment = trimText(r.comment, 'Rated on Google.', 4000);
    const rating = clampRating(r.rating);
    return {
        _id: `google-${reviewHash(String(r.externalId ?? ''), authorName, comment, createdAt)}`,
        kind: 'shop',
        productId: null,
        rating,
        authorName,
        comment,
        createdAt,
        source: 'google',
    };
}

export async function loadGoogleBusinessReviewsForApi(): Promise<GoogleReviewForClient[]> {
    const feed = await GoogleReviewFeed.findOne({ sourceKey: FEED_KEY }).lean();
    const reviews: Array<{
        externalId?: string;
        authorName?: string;
        rating?: number;
        comment?: string;
        createdAt?: Date | string;
    }> = Array.isArray(feed?.reviews) ? feed.reviews : [];
    return reviews
        .slice()
        .sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime())
        .map(mapStoredReview);
}

export async function loadGoogleReviewSyncStatus(): Promise<GoogleReviewSyncStatus> {
    const feed = await GoogleReviewFeed.findOne({ sourceKey: FEED_KEY }).lean();
    return {
        sourceUrl: feed?.sourceUrl || configuredSourceUrl(),
        reviewCount: Number(feed?.reviewCount || 0),
        lastRequestedAt: feed?.lastRequestedAt ? new Date(feed.lastRequestedAt).toISOString() : null,
        lastSyncedAt: feed?.lastSyncedAt ? new Date(feed.lastSyncedAt).toISOString() : null,
        lastImportStatus: feed?.lastImportStatus || 'idle',
        lastError: String(feed?.lastError || ''),
        lastRequestedBy: String(feed?.lastRequestedBy || ''),
    };
}

function normalizeImportedReview(input: GoogleReviewImportItem, index: number) {
    const authorName = trimText(input.authorName, 'Google user', 100);
    const comment = trimText(input.comment, 'Rated on Google.', 4000);
    const createdAt = safeDate(input.createdAt || input.dateText);
    const dateText = trimText(input.dateText, '', 120);
    const externalId =
        trimText(input.externalId || input.id, '', 200) ||
        reviewHash(authorName, comment, createdAt.toISOString(), String(index));

    return {
        externalId,
        authorName,
        rating: clampRating(input.rating),
        comment,
        dateText,
        createdAt,
    };
}

export async function importGoogleBusinessReviews(payload: GoogleReviewImportPayload): Promise<GoogleReviewSyncStatus> {
    const reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
    const normalized = reviews
        .map((item, index) => normalizeImportedReview(item, index))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    await GoogleReviewFeed.findOneAndUpdate(
        { sourceKey: FEED_KEY },
        {
            $set: {
                sourceUrl: trimText(payload.sourceUrl, configuredSourceUrl(), 2000),
                reviews: normalized,
                reviewCount: normalized.length,
                lastSyncedAt: new Date(),
                lastImportStatus: 'success',
                lastError: '',
            },
            $setOnInsert: {
                sourceKey: FEED_KEY,
                lastRequestedBy: '',
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return loadGoogleReviewSyncStatus();
}

export async function markGoogleReviewRefreshRequested(requestedBy: string): Promise<GoogleReviewSyncStatus> {
    await GoogleReviewFeed.findOneAndUpdate(
        { sourceKey: FEED_KEY },
        {
            $set: {
                sourceUrl: configuredSourceUrl(),
                lastRequestedAt: new Date(),
                lastImportStatus: 'pending',
                lastError: '',
                lastRequestedBy: trimText(requestedBy, '', 160),
            },
            $setOnInsert: {
                sourceKey: FEED_KEY,
                reviews: [],
                reviewCount: 0,
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return loadGoogleReviewSyncStatus();
}

export async function markGoogleReviewRefreshFailed(message: string): Promise<GoogleReviewSyncStatus> {
    await GoogleReviewFeed.findOneAndUpdate(
        { sourceKey: FEED_KEY },
        {
            $set: {
                sourceUrl: configuredSourceUrl(),
                lastImportStatus: 'error',
                lastError: trimText(message, 'Refresh failed.', 1000),
            },
            $setOnInsert: {
                sourceKey: FEED_KEY,
                reviews: [],
                reviewCount: 0,
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return loadGoogleReviewSyncStatus();
}
