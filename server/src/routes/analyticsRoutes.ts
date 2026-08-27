import express from 'express';
import { trackEvent, getAnalyticsSummary, getProductViewStats } from '../controllers/analyticsController';
// import { requireAdmin } from '../middleware/requireAdmin'; // Disabled per requirements

const router = express.Router();

// Public: Track Events
router.post('/events', trackEvent);

// Admin: Get Summary (Auth disabled per requirements)
// router.get('/admin/analytics/summary', requireAdmin, getAnalyticsSummary);
router.get('/admin/analytics/summary', getAnalyticsSummary);

// Admin: Per-product view counts (Auth disabled per requirements, matching the routes above)
// router.get('/admin/analytics/product-views', requireAdmin, getProductViewStats);
router.get('/admin/analytics/product-views', getProductViewStats);

export default router;
