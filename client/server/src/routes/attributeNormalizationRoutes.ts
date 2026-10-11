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
import {
    acceptProposalEndpoint,
    acceptSafeProposalsEndpoint,
    generateProposals,
    getProposal,
    getProposalQueue,
    rejectProposalEndpoint,
    revertProposalEndpoint,
} from '../controllers/attributeReviewController';
import {
    approveConversionEndpoint,
    getAttributeTemplate,
    getConversion,
    getConversionQueue,
    getUsedFieldValues,
    nextConversions,
    redoConversionEndpoint,
    repairConversions,
    skipConversionEndpoint,
    startConversions,
    undoConversionEndpoint,
} from '../controllers/productConversionController';

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireAdmin);

router.get('/ai-settings', getAiSettings);
router.get('/ai-settings/models', listAiModels);
router.put('/ai-settings', updateAiSettings);

router.get('/conversion/:id', getConversion);
router.post('/conversion/:id/approve', approveConversionEndpoint);
router.post('/conversion/:id/skip', skipConversionEndpoint);
router.post('/conversion/:id/undo', undoConversionEndpoint);
router.post('/conversion/:id/redo', redoConversionEndpoint);
router.get('/:categoryKey/conversions', getConversionQueue);
router.get('/:categoryKey/conversions/values', getUsedFieldValues);
router.post('/:categoryKey/conversions/start', startConversions);
router.post('/:categoryKey/conversions/next', nextConversions);
router.post('/:categoryKey/conversions/repair', repairConversions);
router.get('/:categoryKey/template', getAttributeTemplate);

router.get('/proposal/:id', getProposal);
router.post('/proposal/:id/accept', acceptProposalEndpoint);
router.post('/proposal/:id/reject', rejectProposalEndpoint);
router.post('/proposal/:id/revert', revertProposalEndpoint);

router.get('/:categoryKey/proposals', getProposalQueue);
router.post('/:categoryKey/proposals/generate', generateProposals);
router.post('/:categoryKey/proposals/accept-safe', acceptSafeProposalsEndpoint);

router.get('/:categoryKey/inventory', getCategoryInventory);
router.get('/:categoryKey/scheme', getNamingScheme);
router.put('/:categoryKey/scheme', updateNamingScheme);
router.post('/:categoryKey/scheme/generate', generateNamingSchemeChunk);
router.post('/:categoryKey/scheme/approve', approveNamingScheme);
router.put('/:categoryKey/template', updateAttributeTemplate);

export default router;
