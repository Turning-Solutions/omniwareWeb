import express from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import { getHomeSettings, updateHomeSettings } from "../controllers/homeSettingsController";

const router = express.Router();

router.get("/", getHomeSettings);
router.put("/", requireAuth, requireAdmin, updateHomeSettings);

export default router;
