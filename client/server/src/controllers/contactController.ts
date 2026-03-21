import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { AppError } from '../middleware/errorMiddleware';
import { sendContactFormEmail, isMailConfigured } from '../services/mail';

const contactBodySchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    email: z.string().trim().email('Invalid email').max(254),
    subject: z.string().trim().min(1, 'Subject is required').max(200),
    message: z.string().trim().min(1, 'Message is required').max(10000),
});

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 8;
const contactHits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_WINDOW_MS;
    const hits = (contactHits.get(ip) || []).filter((t) => t > windowStart);
    if (hits.length >= RATE_MAX) return true;
    hits.push(now);
    contactHits.set(ip, hits);
    return false;
}

function clientIp(req: Request): string {
    const xf = req.headers['x-forwarded-for'];
    if (typeof xf === 'string' && xf.trim()) {
        return xf.split(',')[0]!.trim();
    }
    return req.socket.remoteAddress || 'unknown';
}

export const postContact = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isMailConfigured()) {
            const err: AppError = new Error(
                'The contact form is temporarily unavailable. Please email support@omniware.lk directly.'
            );
            err.status = 503;
            err.code = 'MAIL_NOT_CONFIGURED';
            return next(err);
        }

        const parsed = contactBodySchema.safeParse(req.body);
        if (!parsed.success) {
            const first = parsed.error.issues[0];
            const err: AppError = new Error(first?.message || 'Invalid form data');
            err.status = 400;
            err.code = 'VALIDATION_ERROR';
            err.details = parsed.error.flatten();
            return next(err);
        }

        const ip = clientIp(req);
        if (isRateLimited(ip)) {
            const err: AppError = new Error('Too many messages from this address. Please try again later.');
            err.status = 429;
            err.code = 'RATE_LIMITED';
            return next(err);
        }

        await sendContactFormEmail(parsed.data);
        res.status(200).json({ ok: true, message: 'Message sent successfully.' });
    } catch (e) {
        console.error('[postContact]', e);
        const err: AppError = new Error('Failed to send your message. Please try again or email us directly.');
        err.status = 500;
        err.code = 'MAIL_SEND_FAILED';
        return next(err);
    }
};
