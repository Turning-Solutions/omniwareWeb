import express from 'express';
import { addOrderItems, getMyOrders } from '../controllers/orderController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', protect, addOrderItems);
router.get('/me', protect, getMyOrders);

export default router;
