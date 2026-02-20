import express from 'express';
import { getOrders, updateOrderStatus, getOrderById } from '../controllers/orderController';
import { getAnalyticsSummary } from '../controllers/analyticsController';

const router = express.Router();

// Analytics
router.get('/analytics/summary', getAnalyticsSummary);

// Orders
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

export default router;
