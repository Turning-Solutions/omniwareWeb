"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnalyticsSummary = exports.trackEvent = void 0;
const zod_1 = require("zod");
const Event_1 = require("../models/Event");
const AnalyticsDaily_1 = require("../models/AnalyticsDaily");
const Order_1 = __importDefault(require("../models/Order"));
// --- Validation Schemas ---
const eventSchema = zod_1.z.object({
    type: zod_1.z.enum([
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
    ]),
    userId: zod_1.z.string().optional(),
    sessionId: zod_1.z.string().optional(),
    productId: zod_1.z.string().optional(),
    orderId: zod_1.z.string().optional(),
    category: zod_1.z.string().optional(),
    brand: zod_1.z.string().optional(),
    props: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional()
});
// --- Rate Limiting (Basic In-Memory) ---
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_IP = 60; // 1 request per second avg
const ipRequests = new Map();
const checkRateLimit = (ip) => {
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
const trackEvent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(ip)) {
        res.status(429).json({ error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } });
        return;
    }
    try {
        const validated = eventSchema.parse(req.body);
        const event = new Event_1.Event(Object.assign(Object.assign({}, validated), { ts: new Date(), ua: req.headers['user-agent'], ip: ip, referrer: req.headers['referer'] }));
        yield event.save();
        res.status(201).json({ success: true });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid event data', details: error.issues } }); // Use .issues instead of .errors
            return;
        }
        console.error('Track Event Error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to track event' } });
    }
});
exports.trackEvent = trackEvent;
/**
 * GET /api/v1/admin/analytics/summary
 * Returns aggregated analytics for a given range
 * Query: range (7d, 30d, today) OR from/to (YYYY-MM-DD)
 */
const getAnalyticsSummary = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { range, from, to } = req.query;
        let startDate;
        let endDate;
        const today = new Date().toISOString().split('T')[0];
        if (from && to) {
            startDate = from;
            endDate = to;
        }
        else if (range === 'today') {
            startDate = today;
            endDate = today;
        }
        else if (range === '30d') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            startDate = d.toISOString().split('T')[0];
            endDate = today;
        }
        else {
            // Default 7d
            const d = new Date();
            d.setDate(d.getDate() - 7);
            startDate = d.toISOString().split('T')[0];
            endDate = today;
        }
        // 1. Aggregate sums from AnalyticsDaily
        const dailyStats = yield AnalyticsDaily_1.AnalyticsDaily.find({
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: 1 }).lean();
        // Initialize Summary
        const summary = {
            revenue: 0,
            orders: 0,
            productViews: 0,
            chartData: [], // Daily breakdown for charts
            topProducts: [],
            topCategories: [],
            topBrands: []
        };
        // Aggregation Maps
        const prodMap = new Map();
        const catMap = new Map();
        const brandMap = new Map();
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
                if (!prodMap.has(pid))
                    prodMap.set(pid, Object.assign(Object.assign({}, p), { views: 0, purchases: 0 }));
                const existing = prodMap.get(pid);
                existing.views += p.views;
                existing.purchases += p.purchases;
            });
            day.topCategories.forEach(c => {
                if (!catMap.has(c.category))
                    catMap.set(c.category, Object.assign(Object.assign({}, c), { views: 0, purchases: 0 }));
                const existing = catMap.get(c.category);
                existing.views += c.views;
                existing.purchases += c.purchases;
            });
            day.topBrands.forEach(b => {
                if (!brandMap.has(b.brand))
                    brandMap.set(b.brand, Object.assign(Object.assign({}, b), { views: 0, purchases: 0 }));
                const existing = brandMap.get(b.brand);
                existing.views += b.views;
                existing.purchases += b.purchases;
            });
        }
        summary.topProducts = Array.from(prodMap.values()).sort((a, b) => b.purchases - a.purchases).slice(0, 10);
        summary.topCategories = Array.from(catMap.values()).sort((a, b) => b.purchases - a.purchases).slice(0, 10);
        summary.topBrands = Array.from(brandMap.values()).sort((a, b) => b.purchases - a.purchases).slice(0, 10);
        // 2. Fetch Recent Orders (Real)
        const recentOrders = yield Order_1.default.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('user', 'name email')
            .lean();
        // Transform orders for frontend
        const formattedOrders = recentOrders.map(o => {
            var _a;
            return ({
                id: o._id,
                customer: ((_a = o.user) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown',
                total: o.totalPrice,
                status: o.status,
                date: o.createdAt
            });
        });
        res.json({
            summary,
            recentOrders: formattedOrders
        });
    }
    catch (error) {
        console.error('Get Analytics Error:', error);
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } });
    }
});
exports.getAnalyticsSummary = getAnalyticsSummary;
