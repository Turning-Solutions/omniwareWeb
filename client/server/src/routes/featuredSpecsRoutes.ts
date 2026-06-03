import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
    getAvailableSpecKeys,
    getFeaturedSpecs,
    updateFeaturedSpecs,
    deleteFeaturedSpecs,
    getSpecValues
} from '../controllers/featuredSpecsController';

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireAdmin);

router.get('/:categoryKey/spec-keys', getAvailableSpecKeys);
router.get('/:categoryKey/spec-values/:specKey', getSpecValues);
router.get('/:categoryKey/featured-specs', getFeaturedSpecs);
router.put('/:categoryKey/featured-specs', updateFeaturedSpecs);
router.delete('/:categoryKey/featured-specs', deleteFeaturedSpecs);

export default router;
