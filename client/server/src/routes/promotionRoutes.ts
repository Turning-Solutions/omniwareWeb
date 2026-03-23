import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
    getActivePromotions,
    getAllPromotions,
    createPromotion,
    updatePromotion,
    deletePromotion,
} from '../controllers/promotionController';

const router = express.Router();

// Public — no auth needed
router.get('/active', getActivePromotions);

// Admin-only
router.use(requireAuth, requireAdmin);
router.get('/', getAllPromotions);
router.post('/', createPromotion);
router.put('/:id', updatePromotion);
router.delete('/:id', deletePromotion);

export default router;
