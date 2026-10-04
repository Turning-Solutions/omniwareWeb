import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { getCategoryInventory } from '../controllers/attributeNormalizationController';

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireAdmin);

router.get('/:categoryKey/inventory', getCategoryInventory);

export default router;
