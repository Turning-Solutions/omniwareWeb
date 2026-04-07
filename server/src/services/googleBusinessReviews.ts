import crypto from 'crypto';

type GoogleFindPlaceResponse = {
    status: string;
    error_message?: string;
    candidates?: Array<{ place_id?: string }>;
};

type GooglePlaceReview = {
    author_name?: string;
    rating?: number;
    text?: string;
    time?: number;
};

type GooglePlaceDetailsResponse = {
    status: string;
    error_message?: string;
    result?: {
        reviews?: GooglePlaceReview[];
    };
};

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

const DEFAULT_LAT = 6.8499365;
const DEFAULT_LNG = 79.8866177;

let cachedPlaceId: string | null = null;
let cachedPlaceIdUntil = 0;

let cachedReviews: GoogleReviewForClient[] | null = null;
let cachedReviewsUntil = 0;

const PLACE_ID_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REVIEWS_TTL_MS = 60 * 60 * 1000;

function businessLatLng(): { lat: number; lng: number } {
    const lat = Number(process.env.GOOGLE_BUSINESS_LAT);
    const lng = Number(process.env.GOOGLE_BUSINESS_LNG);
    const ok = Number.isFinite(lat) && Number.isFinite(lng);
    return ok ? { lat, lng } : { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
}

async function resolvePlaceId(apiKey: string): Promise<string | null> {
    const fromEnv = process.env.GOOGLE_BUSINESS_PLACE_ID?.trim();
    if (fromEnv) return fromEnv;

    const now = Date.now();
    if (cachedPlaceId && cachedPlaceIdUntil > now) return cachedPlaceId;

    const { lat, lng } = businessLatLng();
    const query = process.env.GOOGLE_BUSINESS_FIND_QUERY?.trim() || 'Omniware Technologies';

    const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
    url.searchParams.set('input', query);
    url.searchParams.set('inputtype', 'textquery');
    url.searchParams.set('fields', 'place_id');
    url.searchParams.set('locationbias', `circle:3000@${lat},${lng}`);
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    const data = (await res.json()) as GoogleFindPlaceResponse;
    if (data.status !== 'OK' || !data.candidates?.[0]?.place_id) {
        console.warn('[google reviews] find place:', data.status, data.error_message ?? '');
        return null;
    }

    const pid = data.candidates[0].place_id;
    cachedPlaceId = pid;
    cachedPlaceIdUntil = now + PLACE_ID_TTL_MS;
    return pid;
}

function mapGoogleReview(r: GooglePlaceReview): GoogleReviewForClient {
    const author = String(r.author_name || 'Google user').slice(0, 100);
    const timeSec = typeof r.time === 'number' ? r.time : 0;
    const text = String(r.text || '').trim();
    const rawRating = Number(r.rating);
    const rating = Number.isFinite(rawRating) ? Math.min(5, Math.max(1, Math.round(rawRating))) : 5;
    const idBase = `${timeSec}:${author}:${text.slice(0, 48)}`;
    const _id = `google-${crypto.createHash('sha256').update(idBase).digest('hex').slice(0, 24)}`;
    return {
        _id,
        kind: 'shop',
        productId: null,
        rating,
        authorName: author,
        comment: text || 'Rated on Google.',
        createdAt: new Date(timeSec * 1000).toISOString(),
        source: 'google',
    };
}

/**
 * Fetches up to five recent Google Business reviews (Places API Place Details limit).
 * Cached in memory for one hour. Requires GOOGLE_PLACES_API_KEY.
 */
export async function loadGoogleBusinessReviewsForApi(): Promise<GoogleReviewForClient[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
    if (!apiKey) return [];

    const now = Date.now();
    if (cachedReviews && cachedReviewsUntil > now) return cachedReviews;

    const placeId = await resolvePlaceId(apiKey);
    if (!placeId) return [];

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('fields', 'reviews');
    url.searchParams.set('reviews_sort', 'newest');
    url.searchParams.set('key', apiKey);

    const res = await fetch(url.toString());
    const data = (await res.json()) as GooglePlaceDetailsResponse;
    if (data.status !== 'OK' || !data.result?.reviews?.length) {
        console.warn('[google reviews] place details:', data.status, data.error_message ?? '');
        return [];
    }

    const list = data.result.reviews.map(mapGoogleReview);
    cachedReviews = list;
    cachedReviewsUntil = now + REVIEWS_TTL_MS;
    return list;
}
