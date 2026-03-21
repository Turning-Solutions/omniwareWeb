import express from 'express';
import { postContact } from '../controllers/contactController';

const router = express.Router();

router.post('/', postContact);

export default router;
