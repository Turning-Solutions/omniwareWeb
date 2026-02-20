"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRateLimit = void 0;
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 200;
const ipBuckets = new Map();
const adminRateLimit = (req, res, next) => {
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
exports.adminRateLimit = adminRateLimit;
