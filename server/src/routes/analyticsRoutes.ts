import express from 'express';
import { trackEvent, getAnalyticsSummary } from '../controllers/analyticsController';
// import { requireAdmin } from '../middleware/requireAdmin'; // Disabled per requirements

const router = express.Router();

// Public: Track Events
router.post('/events', trackEvent);

// Admin: Get Summary (Auth disabled per requirements)
// router.get('/admin/analytics/summary', requireAdmin, getAnalyticsSummary);
router.get('/admin/analytics/summary', getAnalyticsSummary);

export default router;
