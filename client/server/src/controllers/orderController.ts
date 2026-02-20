import { Request, Response } from 'express';
import Order from '../models/Order';
import { OrderEvent } from '../models/OrderEvent';
import { Event } from '../models/Event'; // For tracking
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

// Helper to emit events without blocking response
const emitEvent = async (type: string, payload: any) => {
    try {
        await Event.create({
            type,
            ts: new Date(),
            ...payload
        });
    } catch (err) {
        console.error(`Failed to emit event ${type}:`, err);
    }
};

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Private
export const addOrderItems = async (req: AuthRequest, res: Response) => {
    const {
        orderItems,
        shippingAddress,
        paymentMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        res.status(400).json({ message: 'No order items' });
        return;
    }

    try {
        const order = new Order({
            orderItems,
            user: req.user._id,
            shippingAddress,
            paymentMethod,
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
        });

        const createdOrder = await order.save();

        // Emit analytics event
        emitEvent('order_created', {
            orderId: createdOrder._id,
            userId: req.user._id,
            props: { total: totalPrice, itemsCount: orderItems.length }
        });

        res.status(201).json(createdOrder);
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/v1/orders/myorders
// @access  Private
export const getMyOrders = async (req: AuthRequest, res: Response) => {
    try {
        const orders = await Order.find({ user: req.user._id });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

// @desc    Get all orders (Admin)
// @route   GET /api/v1/admin/orders
// @access  Private/Admin
export const getOrders = async (req: Request, res: Response) => {
    try {
        const { page = 1, limit = 20, status, search, minTotal, maxTotal, from, to, sort } = req.query;

        const query: any = {};

        // Status Filter
        if (status) {
            query.status = status;
        }

        // Price Range Filter
        if (minTotal || maxTotal) {
            query.totalPrice = {};
            if (minTotal) query.totalPrice.$gte = Number(minTotal);
            if (maxTotal) query.totalPrice.$lte = Number(maxTotal);
        }

        // Date Range Filter
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from as string);
            if (to) query.createdAt.$lte = new Date(new Date(to as string).setHours(23, 59, 59, 999));
        }

        // Search (by ID or User Name/Email if populated, but regex on ID is tricky.
        // Let's search ID directly or populate user and filter? 
        // Searching populated fields in Mongo requires aggregate or separate query.
        // Simple approach: ID exact match or regex if valid ObjectId
        if (search) {
            const searchStr = search as string;
            const orConditions = [];

            if (mongoose.Types.ObjectId.isValid(searchStr)) {
                orConditions.push({ _id: searchStr });
                orConditions.push({ user: searchStr });
            }
            // NOTE: Simple Regex search on non-populated fields. 
            // To search user email/name, we'd need aggregation lookup.
            // For constraint compliance, keeping it simple to Order fields or known ID.
        }

        // Sorting
        let sortOption: any = { createdAt: -1 }; // Default
        if (sort === 'total_asc') sortOption = { totalPrice: 1 };
        if (sort === 'total_desc') sortOption = { totalPrice: -1 };
        if (sort === 'oldest') sortOption = { createdAt: 1 };


        const pageSize = Number(limit);
        const pageNum = Number(page);
        const skip = (pageNum - 1) * pageSize;

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('user', 'id name email')
                .sort(sortOption)
                .skip(skip)
                .limit(pageSize)
                .lean(),
            Order.countDocuments(query)
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

    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

// @desc    Update order status
// @route   PATCH /api/v1/admin/orders/:id/status
// @access  Private/Admin
export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded'];

        if (!validStatuses.includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }

        const order = await Order.findById(req.params.id);

        if (order) {
            const prevStatus = order.status;
            order.status = status;

            // Auto update deliveredAt
            if (status === 'delivered') {
                order.isDelivered = true;
                order.deliveredAt = new Date();
            }

            const updatedOrder = await order.save();

            // Log Order Event
            await OrderEvent.create({
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
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

// @desc    Get order by ID (needed for details)
// @route   GET /api/v1/admin/orders/:id
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email');
        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};
