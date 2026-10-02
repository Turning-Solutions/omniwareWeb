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
import {
    getCategoryAttributeNames,
    getAttributeAliases,
    updateAttributeAliases
} from '../controllers/attributeAliasController';

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireAdmin);

router.get('/:categoryKey/spec-keys', getAvailableSpecKeys);
router.get('/:categoryKey/spec-values/:specKey', getSpecValues);
router.get('/:categoryKey/featured-specs', getFeaturedSpecs);
router.put('/:categoryKey/featured-specs', updateFeaturedSpecs);
router.delete('/:categoryKey/featured-specs', deleteFeaturedSpecs);
router.get('/:categoryKey/attribute-names', getCategoryAttributeNames);
router.get('/:categoryKey/attribute-aliases', getAttributeAliases);
router.put('/:categoryKey/attribute-aliases', updateAttributeAliases);

export default router;
