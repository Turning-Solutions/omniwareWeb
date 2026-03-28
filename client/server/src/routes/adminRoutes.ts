import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getOrders, updateOrderStatus, getOrderById } from '../controllers/orderController';
import { getAnalyticsSummary } from '../controllers/analyticsController';
import { listAdminReviews, updateReviewStatus, deleteAdminReview } from '../controllers/adminReviewController';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Analytics
router.get('/analytics/summary', getAnalyticsSummary);

// Orders
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

// Customer reviews (moderation)
router.get('/reviews', listAdminReviews);
router.post('/reviews/:id/status', updateReviewStatus);
router.patch('/reviews/:id', updateReviewStatus);
router.delete('/reviews/:id', deleteAdminReview);

export default router;
