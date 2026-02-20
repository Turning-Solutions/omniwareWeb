"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrderById = exports.updateOrderStatus = exports.getOrders = exports.getMyOrders = exports.addOrderItems = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const OrderEvent_1 = require("../models/OrderEvent");
const Event_1 = require("../models/Event"); // For tracking
const mongoose_1 = __importDefault(require("mongoose"));
// Helper to emit events without blocking response
const emitEvent = (type, payload) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield Event_1.Event.create(Object.assign({ type, ts: new Date() }, payload));
    }
    catch (err) {
        console.error(`Failed to emit event ${type}:`, err);
    }
});
// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
const addOrderItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { orderItems, shippingAddress, paymentMethod, itemsPrice, taxPrice, shippingPrice, totalPrice, } = req.body;
    if (orderItems && orderItems.length === 0) {
        res.status(400).json({ message: 'No order items' });
        return;
    }
    try {
        const order = new Order_1.default({
            orderItems,
            user: req.user._id,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        });
        const createdOrder = yield order.save();
        // Emit analytics event
        emitEvent('order_created', {
            orderId: createdOrder._id,
            userId: req.user._id,
            props: { total: totalPrice, itemsCount: orderItems.length }
        });
        res.status(201).json(createdOrder);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.addOrderItems = addOrderItems;
// @desc    Get logged in user orders
// @route   GET /api/v1/orders/myorders
// @access  Private
const getMyOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orders = yield Order_1.default.find({ user: req.user._id });
        res.json(orders);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getMyOrders = getMyOrders;
// @desc    Get all orders (Admin)
// @route   GET /api/v1/admin/orders
// @access  Private/Admin
const getOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = 1, limit = 20, status, search, minTotal, maxTotal, from, to, sort } = req.query;
        const query = {};
        // Status Filter
        if (status) {
            query.status = status;
        }
        // Price Range Filter
        if (minTotal || maxTotal) {
            query.totalPrice = {};
            if (minTotal)
                query.totalPrice.$gte = Number(minTotal);
            if (maxTotal)
                query.totalPrice.$lte = Number(maxTotal);
        }
        // Date Range Filter
        if (from || to) {
            query.createdAt = {};
            if (from)
                query.createdAt.$gte = new Date(from);
            if (to)
                query.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }
        // Search (by ID or User Name/Email if populated, but regex on ID is tricky.
        // Let's search ID directly or populate user and filter? 
        // Searching populated fields in Mongo requires aggregate or separate query.
        // Simple approach: ID exact match or regex if valid ObjectId
        if (search) {
            const searchStr = search;
            const orConditions = [];
            if (mongoose_1.default.Types.ObjectId.isValid(searchStr)) {
                orConditions.push({ _id: searchStr });
                orConditions.push({ user: searchStr });
            }
            // NOTE: Simple Regex search on non-populated fields. 
            // To search user email/name, we'd need aggregation lookup.
            // For constraint compliance, keeping it simple to Order fields or known ID.
        }
        // Sorting
        let sortOption = { createdAt: -1 }; // Default
        if (sort === 'total_asc')
            sortOption = { totalPrice: 1 };
        if (sort === 'total_desc')
            sortOption = { totalPrice: -1 };
        if (sort === 'oldest')
            sortOption = { createdAt: 1 };
        const pageSize = Number(limit);
        const pageNum = Number(page);
        const skip = (pageNum - 1) * pageSize;
        const [orders, total] = yield Promise.all([
            Order_1.default.find(query)
                .populate('user', 'id name email')
                .sort(sortOption)
                .skip(skip)
                .limit(pageSize)
                .lean(),
            Order_1.default.countDocuments(query)
        ]);
        res.json({
            data: orders,
            pagination: {
                page: pageNum,
                limit: pageSize,
                total,
                pages: Math.ceil(total / pageSize)
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getOrders = getOrders;
// @desc    Update order status
// @route   PATCH /api/v1/admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];
        if (!validStatuses.includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }
        const order = yield Order_1.default.findById(req.params.id);
        if (order) {
            const prevStatus = order.status;
            order.status = status;
            // Auto update deliveredAt
            if (status === 'delivered') {
                order.isDelivered = true;
                order.deliveredAt = new Date();
            }
            const updatedOrder = yield order.save();
            // Log Order Event
            yield OrderEvent_1.OrderEvent.create({
                orderId: order._id,
                status: status,
                prevStatus: prevStatus,
                // changedBy: req.user._id // If auth was enabled
                note: `Status updated from ${prevStatus} to ${status}`
            });
            // Emit Analytics Event
            emitEvent('order_status_changed', {
                orderId: order._id,
                props: { prevStatus, newStatus: status }
            });
            res.json(updatedOrder);
        }
        else {
            res.status(404).json({ message: 'Order not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateOrderStatus = updateOrderStatus;
// @desc    Get order by ID (needed for details)
// @route   GET /api/v1/admin/orders/:id
const getOrderById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const order = yield Order_1.default.findById(req.params.id).populate('user', 'name email');
        if (order) {
            res.json(order);
        }
        else {
            res.status(404).json({ message: 'Order not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getOrderById = getOrderById;
