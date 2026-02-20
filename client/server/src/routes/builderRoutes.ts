import express from 'express';
import { createBuildRequest } from '../controllers/builderController';

const router = express.Router();

router.post('/requests', createBuildRequest);

export default router;
