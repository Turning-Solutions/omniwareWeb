"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const analyticsController_1 = require("../controllers/analyticsController");
// import { requireAdmin } from '../middleware/requireAdmin'; // Disabled per requirements
const router = express_1.default.Router();
// Public: Track Events
router.post('/events', analyticsController_1.trackEvent);
// Admin: Get Summary (Auth disabled per requirements)
// router.get('/admin/analytics/summary', requireAdmin, getAnalyticsSummary);
router.get('/admin/analytics/summary', analyticsController_1.getAnalyticsSummary);
exports.default = router;
