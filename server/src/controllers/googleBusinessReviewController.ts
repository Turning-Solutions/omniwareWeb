import { Request, Response } from 'express';
import { loadGoogleBusinessReviewsForApi } from '../services/googleBusinessReviews';

export async function getGoogleBusinessReviews(_req: Request, res: Response) {
    try {
        const reviews = await loadGoogleBusinessReviewsForApi();
        res.set('Cache-Control', 'public, max-age=1800');
        res.json({ reviews });
    } catch (e) {
        console.error(e);
        res.set('Cache-Control', 'private, no-store');
        res.json({ reviews: [] });
    }
}
