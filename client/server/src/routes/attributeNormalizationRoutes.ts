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

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireAdmin);

router.get('/ai-settings', getAiSettings);
router.get('/ai-settings/models', listAiModels);
router.put('/ai-settings', updateAiSettings);

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
