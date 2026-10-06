import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
    approveNamingScheme,
    generateNamingSchemeChunk,
    getAiSettings,
    getCategoryInventory,
    listAiModels,
    getNamingScheme,
    updateAiSettings,
    updateAttributeTemplate,
    updateNamingScheme,
} from '../controllers/attributeNormalizationController';

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireAdmin);

router.get('/ai-settings', getAiSettings);
router.get('/ai-settings/models', listAiModels);
router.put('/ai-settings', updateAiSettings);
router.get('/:categoryKey/inventory', getCategoryInventory);
router.get('/:categoryKey/scheme', getNamingScheme);
router.put('/:categoryKey/scheme', updateNamingScheme);
router.post('/:categoryKey/scheme/generate', generateNamingSchemeChunk);
router.post('/:categoryKey/scheme/approve', approveNamingScheme);
router.put('/:categoryKey/template', updateAttributeTemplate);

export default router;
