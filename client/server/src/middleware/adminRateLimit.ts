import { Request, Response, NextFunction } from 'express';

const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 200;

type Bucket = { count: number; resetAt: number };
const ipBuckets = new Map<string, Bucket>();

export const adminRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.ip || req.headers['x-forwarded-for'] || 'unknown').toString();
    const now = Date.now();
    const bucket = ipBuckets.get(ip) || { count: 0, resetAt: now + WINDOW_MS };

    if (now > bucket.resetAt) {
        bucket.count = 0;
        bucket.resetAt = now + WINDOW_MS;
    }

    bucket.count += 1;
    ipBuckets.set(ip, bucket);

    if (bucket.count > MAX_REQUESTS) {
        return res.status(429).json({ message: 'Too many requests (admin rate limit)' });
    }

    return next();
};

