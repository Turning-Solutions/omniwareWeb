import { Request, Response } from 'express';
import { z } from 'zod';
import { Event } from '../models/Event';
import { AnalyticsDaily } from '../models/AnalyticsDaily';
import Order from '../models/Order';
import mongoose from 'mongoose';

// --- Validation Schemas ---
const eventSchema = z.object({
    type: z.enum([
        'product_view',
        'add_to_cart',
        'remove_from_cart',
        'checkout_started',
        'order_created',
        'payment_success',
        'payment_failed',
        'order_status_changed',
        'search_performed',
        'filter_applied'
    ] as [string, ...string[]]),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    productId: z.string().optional(),
    orderId: z.string().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    props: z.record(z.string(), z.any()).optional()
});

// --- Rate Limiting (Basic In-Memory) ---
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_IP = 60; // 1 request per second avg
const ipRequests = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const record = ipRequests.get(ip);

    if (!record || now > record.resetTime) {
        ipRequests.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (record.count >= MAX_REQUESTS_PER_IP) {
        return false;
    }

    record.count++;
    return true;
};

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipRequests.entries()) {
        if (now > record.resetTime) {
            ipRequests.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW);

// --- Controllers ---

/**
 * POST /api/v1/events
 * Ingests a new analytics event
 */
export const trackEvent = async (req: Request, res: Response) => {
    const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(ip)) {
        res.status(429).json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } });
        return;
    }

    try {
        const validated = eventSchema.parse(req.body);

        const event = new Event({
            ...validated,
            ts: new Date(),
            ua: req.headers['user-agent'],
            ip: ip,
            referrer: req.headers['referer']
        });

        await event.save();
        res.status(201).json({ success: true });

    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid event data', details: error.issues } }); // Use .issues instead of .errors
            return;
        }
        console.error('Track Event Error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to track event' } });
    }
};

/**
 * GET /api/v1/admin/analytics/summary
 * Returns aggregated analytics for a given range
 * Query: range (7d, 30d, today) OR from/to (YYYY-MM-DD)
 */
export const getAnalyticsSummary = async (req: Request, res: Response) => {
    try {
        const { range, from, to } = req.query;
        let startDate: string;
        let endDate: string;

        const today = new Date().toISOString().split('T')[0];

        if (from && to) {
            startDate = from as string;
            endDate = to as string;
        } else if (range === 'today') {
            startDate = today;
            endDate = today;
        } else if (range === '30d') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            startDate = d.toISOString().split('T')[0];
            endDate = today;
        } else {
            // Default 7d
            const d = new Date();
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString().split('T')[0];
            endDate = today;
        }

        // 1. Aggregate sums from AnalyticsDaily
        const dailyStats = await AnalyticsDaily.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();

        // Initialize Summary
        const summary = {
            revenue: 0,
            orders: 0,
            productViews: 0,
            chartData: [] as any[], // Daily breakdown for charts
            topProducts: [] as any[],
            topCategories: [] as any[],
            topBrands: [] as any[]
        };

        // Aggregation Maps
        const prodMap = new Map<string, any>();
        const catMap = new Map<string, any>();
        const brandMap = new Map<string, any>();

        for (const day of dailyStats) {
            summary.revenue += day.revenue || 0;
            summary.orders += day.orders || 0;
            summary.productViews += day.productViews || 0;

            summary.chartData.push({
                date: day.date,
                revenue: day.revenue,
                orders: day.orders
            });

            // Merge Lists
            day.topProducts.forEach(p => {
                const pid = p.productId ? p.productId.toString() : 'unknown';
                if (!prodMap.has(pid)) prodMap.set(pid, { ...p, views: 0, purchases: 0 });
                const existing = prodMap.get(pid);
                existing.views += p.views;
                existing.purchases += p.purchases;
            });
            day.topCategories.forEach(c => {
                if (!catMap.has(c.category)) catMap.set(c.category, { ...c, views: 0, purchases: 0 });
                const existing = catMap.get(c.category);
                existing.views += c.views;
                existing.purchases += c.purchases;
            });
            day.topBrands.forEach(b => {
                if (!brandMap.has(b.brand)) brandMap.set(b.brand, { ...b, views: 0, purchases: 0 });
                const existing = brandMap.get(b.brand);
                existing.views += b.views;
                existing.purchases += b.purchases;
            });
        }

        summary.topProducts = Array.from(prodMap.values()).sort((a, b) => b.purchases - a.purchases).slice(0, 10);
        summary.topCategories = Array.from(catMap.values()).sort((a, b) => b.purchases - a.purchases).slice(0, 10);
        summary.topBrands = Array.from(brandMap.values()).sort((a, b) => b.purchases - a.purchases).slice(0, 10);

        // 2. Fetch Recent Orders (Real)
        const recentOrders = await Order.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user', 'name email')
            .lean();

        // Transform orders for frontend
        const formattedOrders = recentOrders.map(o => ({
            id: o._id,
            customer: (o.user as any)?.name || 'Unknown',
            total: o.totalPrice,
            status: o.status,
            date: o.createdAt
        }));

        res.json({
            summary,
            recentOrders: formattedOrders
        });

    } catch (error) {
        console.error('Get Analytics Error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } });
    }
};
