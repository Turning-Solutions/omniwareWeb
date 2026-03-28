import express from 'express';
import {
    getShopReviews,
    getProductReviews,
    createShopReview,
    createProductReview,
} from '../controllers/reviewController';

const router = express.Router();

router.get('/shop', getShopReviews);
router.post('/shop', createShopReview);
router.get('/product/:productId', getProductReviews);
router.post('/product/:productId', createProductReview);

export default router;
