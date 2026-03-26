import express from 'express';
import { createQuotationPdf } from '../controllers/quotationController';

const router = express.Router();

// Public endpoint: generates + stores a quotation, then streams a PDF back.
router.post('/pdf', createQuotationPdf);

export default router;

