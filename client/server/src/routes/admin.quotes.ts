import express from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { requireAuth } from '../middleware/requireAuth';
import { getAdminQuoteById, getAdminQuotes } from '../controllers/quotationController';
import { adminRateLimit } from '../middleware/adminRateLimit';

const router = express.Router();

router.use(requireAuth, requireAdmin, adminRateLimit);

// GET /api/v1/admin/quotes
router.get('/', getAdminQuotes);

// GET /api/v1/admin/quotes/:id
router.get('/:id', getAdminQuoteById);

export default router;

