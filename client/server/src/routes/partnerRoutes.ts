import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import {
    getActivePartners,
    getAllPartners,
    createPartner,
    updatePartner,
    deletePartner,
} from "../controllers/partnerController";

const router = express.Router();

// Public
router.get("/active", getActivePartners);

// Admin-only
router.use(requireAuth, requireAdmin);
router.get("/", getAllPartners);
router.post("/", createPartner);
router.put("/:id", updatePartner);
router.delete("/:id", deletePartner);

export default router;
