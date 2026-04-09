import { Request, Response } from 'express';
import {
    importGoogleBusinessReviews,
    loadGoogleReviewSyncStatus,
    markGoogleReviewRefreshFailed,
    markGoogleReviewRefreshRequested,
} from '../services/googleBusinessReviews';

const IMPORT_SECRET_HEADER = 'x-google-review-import-secret';

function baseUrlFromRequest(req: Request): string {
    const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] || req.protocol || 'https';
    const host = (req.headers['x-forwarded-host'] as string | undefined)?.split(',')[0] || req.get('host') || '';
    return `${proto}://${host}`;
}

function normalizedMaxReviews(): number {
    const raw = Number(process.env.GOOGLE_REVIEWS_MAX_REVIEWS);
    if (!Number.isFinite(raw)) return 120;
    return Math.max(1, Math.min(500, Math.round(raw)));
}

export async function getGoogleReviewSyncStatus(_req: Request, res: Response) {
    try {
        const status = await loadGoogleReviewSyncStatus();
        res.json({ status });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to load Google review sync status.' });
    }
}

export async function refreshGoogleReviews(req: Request, res: Response) {
    const webhookUrl = process.env.GOOGLE_REVIEWS_REFRESH_WEBHOOK_URL?.trim();
    const importSecret = process.env.GOOGLE_REVIEWS_IMPORT_SECRET?.trim();

    if (!webhookUrl) {
        res.status(503).json({
            message: 'GOOGLE_REVIEWS_REFRESH_WEBHOOK_URL is not configured. Point it to the hosted google-review-worker service.',
        });
        return;
    }
    if (!importSecret) {
        res.status(503).json({
            message: 'GOOGLE_REVIEWS_IMPORT_SECRET is not configured. Set the shared import secret in the Vercel app.',
        });
        return;
    }

    try {
        const requestedBy = req.authUser?.email || 'admin';
        const status = await markGoogleReviewRefreshRequested(requestedBy);
        const body = {
            sourceUrl: status.sourceUrl,
            importUrl: `${baseUrlFromRequest(req)}/api/v1/admin/google-reviews/import`,
            importSecret,
            maxReviews: normalizedMaxReviews(),
        };

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        const refreshSecret = process.env.GOOGLE_REVIEWS_REFRESH_WEBHOOK_SECRET?.trim();
        if (refreshSecret) headers['x-google-review-refresh-secret'] = refreshSecret;

        const upstream = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!upstream.ok) {
            const upstreamText = await upstream.text().catch(() => '');
            const message = upstreamText || `Refresh webhook failed with ${upstream.status}.`;
            await markGoogleReviewRefreshFailed(message);
            res.status(502).json({ message });
            return;
        }

        res.json({
            ok: true,
            queued: true,
            status,
        });
    } catch (e) {
        console.error(e);
        const message = e instanceof Error ? e.message : 'Failed to queue Google review refresh.';
        await markGoogleReviewRefreshFailed(message).catch((err) => console.error(err));
        res.status(500).json({ message });
    }
}

export async function importGoogleReviews(req: Request, res: Response) {
    const configuredSecret = process.env.GOOGLE_REVIEWS_IMPORT_SECRET?.trim();
    const providedSecret = String(req.headers[IMPORT_SECRET_HEADER] || '').trim();

    if (!configuredSecret) {
        res.status(503).json({ message: 'GOOGLE_REVIEWS_IMPORT_SECRET is not configured.' });
        return;
    }
    if (!providedSecret || providedSecret !== configuredSecret) {
        res.status(401).json({ message: 'Invalid import secret.' });
        return;
    }

    const body = req.body as { sourceUrl?: unknown; reviews?: unknown };
    if (!Array.isArray(body?.reviews)) {
        res.status(400).json({ message: 'reviews must be an array.' });
        return;
    }

    try {
        const status = await importGoogleBusinessReviews({
            sourceUrl: typeof body.sourceUrl === 'string' ? body.sourceUrl : undefined,
            reviews: body.reviews as Array<Record<string, unknown>>,
        });
        res.json({ ok: true, status });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to import Google reviews.' });
    }
}
