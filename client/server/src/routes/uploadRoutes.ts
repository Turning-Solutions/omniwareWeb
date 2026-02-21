import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import {
    uploadImageMiddleware,
    handleUploadImage,
    handleDeleteImage,
} from '../controllers/uploadController';

const router = express.Router();

router.post(
    '/image',
    requireAuth,
    requireAdmin,
    uploadImageMiddleware,
    (req, res) => handleUploadImage(req, res)
);

router.post(
    '/delete-image',
    requireAuth,
    requireAdmin,
    (req, res) => handleDeleteImage(req, res)
);

export default router;
