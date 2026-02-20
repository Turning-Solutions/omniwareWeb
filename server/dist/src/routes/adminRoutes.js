"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const orderController_1 = require("../controllers/orderController");
const analyticsController_1 = require("../controllers/analyticsController");
const router = express_1.default.Router();
// Analytics
router.get('/analytics/summary', analyticsController_1.getAnalyticsSummary);
// Orders
router.get('/orders', orderController_1.getOrders);
router.get('/orders/:id', orderController_1.getOrderById);
router.patch('/orders/:id/status', orderController_1.updateOrderStatus);
exports.default = router;
