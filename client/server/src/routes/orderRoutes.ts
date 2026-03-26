import express from 'express';
import {
    addOrderItems,
    createReceiptUploadSignature,
    getMyOrders,
    uploadOrderReceipt,
    uploadOrderReceiptMiddleware,
} from '../controllers/orderController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/', addOrderItems);
router.post('/receipt-upload-signature', createReceiptUploadSignature);
router.post('/receipt-upload', uploadOrderReceiptMiddleware, uploadOrderReceipt);
router.get('/me', protect, getMyOrders);

export default router;
