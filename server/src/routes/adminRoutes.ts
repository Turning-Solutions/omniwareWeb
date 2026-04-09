import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getOrders, updateOrderStatus, getOrderById } from '../controllers/orderController';
import { getAnalyticsSummary } from '../controllers/analyticsController';
import { listAdminReviews, updateReviewStatus, deleteAdminReview } from '../controllers/adminReviewController';
import {
    getGoogleReviewSyncStatus,
    importGoogleReviews,
    refreshGoogleReviews,
} from '../controllers/adminGoogleReviewController';

const router = express.Router();

router.post('/google-reviews/import', importGoogleReviews);

// Analytics
router.get('/analytics/summary', getAnalyticsSummary);

// Orders
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

// Customer reviews (moderation)
router.get('/reviews', requireAuth, requireAdmin, listAdminReviews);
// POST avoids empty-body issues when Next.js forwards PATCH to Express in some setups
router.post('/reviews/:id/status', requireAuth, requireAdmin, updateReviewStatus);
router.patch('/reviews/:id', requireAuth, requireAdmin, updateReviewStatus);
router.delete('/reviews/:id', requireAuth, requireAdmin, deleteAdminReview);
router.get('/google-reviews/status', requireAuth, requireAdmin, getGoogleReviewSyncStatus);
router.post('/google-reviews/refresh', requireAuth, requireAdmin, refreshGoogleReviews);

export default router;
