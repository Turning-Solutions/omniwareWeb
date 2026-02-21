import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getOrders, updateOrderStatus, getOrderById } from '../controllers/orderController';
import { getAnalyticsSummary } from '../controllers/analyticsController';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// Analytics
router.get('/analytics/summary', getAnalyticsSummary);

// Orders
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

export default router;
