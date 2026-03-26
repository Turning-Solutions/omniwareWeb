import { Request, Response } from 'express';
import Order from '../models/Order';
import { OrderEvent } from '../models/OrderEvent';
import { Event } from '../models/Event'; // For tracking
import { AuthRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { sendOrderPlacedEmails, sendOrderStatusUpdatedEmail } from '../services/mail';
import { sendOrderPlacedWhatsApp, sendOrderStatusUpdatedWhatsApp } from '../services/whatsapp';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

// Helper to emit events without blocking response
const emitEvent = async (type: string, payload: Record<string, unknown>) => {
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

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const RECEIPTS_FOLDER = 'omniware/order-receipts';
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_RECEIPT_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']);
const RECEIPT_RETENTION_DAYS = Number(process.env.RECEIPT_RETENTION_DAYS || '180');
let lastReceiptCleanupAt = 0;

const receiptUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_RECEIPT_BYTES },
    fileFilter: (_req, file, cb) => {
        const allowed = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(file.mimetype) || file.mimetype === 'application/pdf';
        if (allowed) cb(null, true);
        else cb(new Error('Only PDF or image files are allowed'));
    },
});

export const uploadOrderReceiptMiddleware = receiptUpload.single('receipt');

type ReceiptUploadPayload = {
    url?: string;
    publicId?: string;
    resourceType?: 'image' | 'raw';
    bytes?: number;
    format?: string;
};

const sanitizeReceiptPublicId = (value: string) => value.replace(/[^a-zA-Z0-9/_.-]/g, '');

function normalizeUrlForCompare(raw: string): string {
    try {
        const u = new URL(raw);
        return `${u.origin}${u.pathname}`;
    } catch {
        return raw;
    }
}

function inferFormat(opts: { format: string; publicId: string; url: string; resourceType: 'image' | 'raw' }): string {
    const explicit = (opts.format || '').toLowerCase().trim();
    if (explicit) return explicit;

    const fromPublicId = (opts.publicId.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
    if (fromPublicId) return fromPublicId;

    const fromUrl = (opts.url.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1] || '').toLowerCase();
    if (fromUrl) return fromUrl;

    // Cloudinary raw resources (especially PDFs) may not include "format" in metadata.
    if (opts.resourceType === 'raw') return 'pdf';
    return '';
}

function isAllowedCloudinaryReceiptUrl(urlRaw: string): boolean {
    try {
        const url = new URL(urlRaw);
        if (url.hostname !== 'res.cloudinary.com') return false;
        const cloud = process.env.CLOUDINARY_CLOUD_NAME;
        if (!cloud) return false;
        return url.pathname.includes(`/${cloud}/`) && url.pathname.includes(`/${RECEIPTS_FOLDER}/`);
    } catch {
        return false;
    }
}

async function resolveCloudinaryResource(publicId: string, resourceTypeHint?: 'image' | 'raw') {
    const candidates = publicId.toLowerCase().endsWith('.pdf')
        ? [publicId, publicId.replace(/\.pdf$/i, '')]
        : [publicId];

    if (resourceTypeHint) {
        let lastErr: unknown;
        for (const candidate of candidates) {
            try {
                return await cloudinary.api.resource(candidate, { resource_type: resourceTypeHint });
            } catch (err) {
                lastErr = err;
            }
        }
        throw lastErr;
    }

    for (const candidate of candidates) {
        try {
            return await cloudinary.api.resource(candidate, { resource_type: 'image' });
        } catch {
            // try next type
        }
        try {
            return await cloudinary.api.resource(candidate, { resource_type: 'raw' });
        } catch {
            // try next candidate
        }
    }

    throw new Error('Uploaded receipt file was not found in storage');
}

async function validateBankTransferReceipt(input: ReceiptUploadPayload) {
    const url = String(input.url || '').trim();
    const publicIdRaw = String(input.publicId || '').trim();
    const publicId = sanitizeReceiptPublicId(publicIdRaw);
    const resourceTypeHint = input.resourceType === 'raw' ? 'raw' : input.resourceType === 'image' ? 'image' : undefined;

    if (!url || !publicId) {
        throw new Error('Receipt upload metadata is missing');
    }
    if (!publicId.startsWith(`${RECEIPTS_FOLDER}/`)) {
        throw new Error('Receipt folder is invalid');
    }
    if (!isAllowedCloudinaryReceiptUrl(url)) {
        throw new Error('Receipt URL domain is invalid');
    }

    const resource = await resolveCloudinaryResource(publicId, resourceTypeHint);
    const resourceType = resource.resource_type as 'image' | 'raw';
    const bytes = Number(resource.bytes || 0);
    const secureUrl = String(resource.secure_url || '');
    const format = inferFormat({
        format: String(resource.format || ''),
        publicId,
        url: secureUrl || url,
        resourceType,
    });

    if (!ALLOWED_RECEIPT_FORMATS.has(format)) {
        throw new Error('Receipt file type is not allowed');
    }
    if (bytes <= 0 || bytes > MAX_RECEIPT_BYTES) {
        throw new Error('Receipt file exceeds allowed size');
    }
    // Cloudinary may return equivalent URL variants (different query/hash forms).
    // Compare normalized URLs and accept if same path.
    const normalizedProvided = normalizeUrlForCompare(url);
    const normalizedResolved = normalizeUrlForCompare(secureUrl);
    if (normalizedResolved && normalizedProvided && normalizedResolved !== normalizedProvided) {
        throw new Error('Receipt URL does not match uploaded file');
    }
    if (!(resourceType === 'image' || resourceType === 'raw')) {
        throw new Error('Receipt resource type is invalid');
    }

    return {
        url: secureUrl,
        publicId,
        resourceType,
        format,
        bytes,
    };
}

async function maybeCleanupOldReceipts() {
    const now = Date.now();
    if (now - lastReceiptCleanupAt < 24 * 60 * 60 * 1000) return;
    lastReceiptCleanupAt = now;

    try {
        const cutoff = new Date(now - RECEIPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const staleOrders = await Order.find({
            'bankTransferReceipt.uploadedAt': { $lt: cutoff },
            'bankTransferReceipt.publicId': { $exists: true, $ne: '' },
        })
            .select('_id bankTransferReceipt')
            .limit(50)
            .lean();

        for (const order of staleOrders as Array<{
            _id: mongoose.Types.ObjectId;
            bankTransferReceipt?: { publicId?: string; resourceType?: 'image' | 'raw' };
        }>) {
            const publicId = order.bankTransferReceipt?.publicId;
            if (!publicId) continue;
            const resourceType = order.bankTransferReceipt?.resourceType || 'raw';
            try {
                await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
            } catch {
                // continue cleanup even if an asset was already removed externally
            }
            await Order.updateOne(
                { _id: order._id },
                { $unset: { bankTransferReceipt: 1 } }
            );
        }
    } catch (err) {
        console.error('Receipt cleanup failed:', err);
    }
}

const ORDER_STATUSES = [
    'waiting_confirmation',
    'confirmed',
    'rejected',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'delivered',
    // Legacy statuses still accepted for backward compatibility
    'pending',
    'paid',
    'shipped',
    'cancelled',
    'refunded',
] as const;

const ORDER_TRANSITIONS: Record<string, string[]> = {
    waiting_confirmation: ['confirmed', 'rejected'],
    confirmed: ['preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'rejected'],
    preparing: ['ready_for_pickup', 'out_for_delivery', 'delivered'],
    ready_for_pickup: ['delivered'],
    out_for_delivery: ['delivered'],
    delivered: [],
    rejected: [],
    // Legacy statuses
    pending: ['confirmed', 'rejected'],
    paid: ['preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'rejected'],
    shipped: ['delivered'],
    cancelled: [],
    refunded: [],
};

const parseCustomerName = (input: unknown): string => {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, 120);
};

const parseCustomerEmail = (input: unknown): string => {
    if (typeof input !== 'string') return '';
    return input.trim().toLowerCase().slice(0, 254);
};

const parseCustomerPhone = (input: unknown): string => {
    if (typeof input !== 'string') return '';
    return input.trim().slice(0, 60);
};

const resolveAuthUser = async (req: Request) => {
    const authHeader = req.headers.authorization;
    const token =
        authHeader && authHeader.startsWith('Bearer') ? authHeader.split(' ')[1] : undefined;

    if (!token) return null;

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_ACCESS_SECRET || 'changeme_access'
        ) as { id?: string };

        if (!decoded.id) return null;
        return await User.findById(decoded.id).select('name email role');
    } catch {
        return null;
    }
};

// @desc    Create new order
// @route   POST /api/v1/orders
// @access  Public (optionally authenticated)
export const addOrderItems = async (req: Request, res: Response) => {
    const {
        orderItems,
        shippingAddress,
        paymentMethod,
        itemsPrice,
        taxPrice,
        shippingPrice,
        totalPrice,
        customer,
        bankTransferReceipt,
    } = req.body;

    if (orderItems && orderItems.length === 0) {
        res.status(400).json({ message: 'No order items' });
        return;
    }

    try {
        const authUser = await resolveAuthUser(req);
        const customerName = parseCustomerName(customer?.name) || authUser?.name || '';
        const customerEmail = parseCustomerEmail(customer?.email) || authUser?.email || '';
        const customerPhone = parseCustomerPhone(customer?.phone);

        if (!customerName || !customerEmail) {
            res.status(400).json({ message: 'Customer name and email are required' });
            return;
        }

        let validatedReceipt: Awaited<ReturnType<typeof validateBankTransferReceipt>> | null = null;
        if (paymentMethod === 'bank_transfer') {
            try {
                validatedReceipt = await validateBankTransferReceipt(bankTransferReceipt || {});
            } catch (receiptError) {
                res.status(400).json({ message: (receiptError as Error).message });
                return;
            }
        }

        const order = new Order({
            orderItems,
            user: authUser?._id,
            customer: {
                name: customerName,
                email: customerEmail,
                ...(customerPhone ? { phone: customerPhone } : {}),
            },
            shippingAddress,
            paymentMethod,
            ...(validatedReceipt
                ? {
                    bankTransferReceipt: {
                        url: validatedReceipt.url,
                        publicId: validatedReceipt.publicId,
                        resourceType: validatedReceipt.resourceType,
                        format: validatedReceipt.format,
                        bytes: validatedReceipt.bytes,
                        uploadedAt: new Date(),
                    },
                }
                : {}),
            itemsPrice,
            taxPrice,
            shippingPrice,
            totalPrice,
            status: 'waiting_confirmation',
        });

        const createdOrder = await order.save();
        void maybeCleanupOldReceipts();

        // Emit analytics event
        emitEvent('order_created', {
            orderId: createdOrder._id,
            userId: authUser?._id || null,
            props: { total: totalPrice, itemsCount: orderItems.length }
        });

        void sendOrderPlacedEmails({
            orderId: String(createdOrder._id),
            orderStatus: String(createdOrder.status),
            customerName,
            customerEmail,
            customerPhone: customerPhone || undefined,
            totalPrice,
            paymentMethod,
            shippingAddress,
            orderItems,
        });
        void sendOrderPlacedWhatsApp({
            customerName,
            customerPhone: customerPhone || undefined,
            orderId: String(createdOrder._id),
            status: String(createdOrder.status),
        });

        res.status(201).json(createdOrder);
    } catch (error) {
        console.error('[addOrderItems] failed:', error);
        res.status(500).json({ message: (error as Error).message });
    }
};

// @desc    Sign direct Cloudinary upload for receipts
// @route   POST /api/v1/orders/receipt-upload-signature
// @access  Public
export const createReceiptUploadSignature = async (req: Request, res: Response) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(503).json({ message: 'Receipt upload is not configured' });
        return;
    }

    const fileType = String(req.body?.fileType || '').toLowerCase();
    const isPdf = fileType === 'application/pdf';
    const isImage = /^image\/(jpeg|jpg|png|webp|gif)$/i.test(fileType);

    if (!isPdf && !isImage) {
        res.status(400).json({ message: 'Only PDF or image files are allowed' });
        return;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    // When using both folder + public_id, public_id should be basename only.
    const publicId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const resourceType = isPdf ? 'raw' : 'image';
    const paramsToSign = {
        folder: RECEIPTS_FOLDER,
        public_id: publicId,
        timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

    res.json({
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder: RECEIPTS_FOLDER,
        publicId,
        resourceType,
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
        maxBytes: MAX_RECEIPT_BYTES,
        allowedMimeTypes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
    });
};

// @desc    Upload customer bank transfer receipt
// @route   POST /api/v1/orders/receipt-upload
// @access  Public
export const uploadOrderReceipt = async (req: Request, res: Response) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        res.status(503).json({ message: 'Receipt upload is not configured' });
        return;
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file?.buffer) {
        res.status(400).json({ message: 'No receipt file found. Use field name "receipt".' });
        return;
    }

    try {
        const isPdf = file.mimetype === 'application/pdf';
        let result;
        if (isPdf) {
            const dataUri = `data:application/pdf;base64,${file.buffer.toString('base64')}`;
            result = await cloudinary.uploader.upload(dataUri, {
                folder: 'omniware/order-receipts',
                resource_type: 'raw',
                format: 'pdf',
            });
        } else {
            const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
            result = await cloudinary.uploader.upload(dataUri, {
                folder: 'omniware/order-receipts',
                resource_type: 'image',
            });
        }

        res.status(200).json({ url: result.secure_url, publicId: result.public_id });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message || 'Receipt upload failed' });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/v1/orders/myorders
// @access  Private
export const getMyOrders = async (req: AuthRequest, res: Response) => {
    if (!req.user?._id) {
        res.status(401).json({ message: 'Not authorized' });
        return;
    }

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

        // Make query shape explicit so TS knows nested operator fields are writable.
        const query: Record<string, any> = {};

        // Status Filter
        if (status) {
            query.status = status;
        }

        // Price Range Filter
        if (minTotal || maxTotal) {
            const totalPrice: Record<string, any> = {};
            if (minTotal) totalPrice.$gte = Number(minTotal);
            if (maxTotal) totalPrice.$lte = Number(maxTotal);
            query.totalPrice = totalPrice;
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
            const orConditions: Record<string, unknown>[] = [];

            if (mongoose.Types.ObjectId.isValid(searchStr)) {
                orConditions.push({ _id: searchStr });
                orConditions.push({ user: searchStr });
            }

            const searchRegex = new RegExp(searchStr, 'i');
            orConditions.push({ 'customer.name': searchRegex });
            orConditions.push({ 'customer.email': searchRegex });
            query.$or = orConditions;
        }

        // Sorting
        let sortOption: Record<string, 1 | -1> = { createdAt: -1 }; // Default
        if (sort === 'total_asc') sortOption = { totalPrice: 1 };
        if (sort === 'total_desc') sortOption = { totalPrice: -1 };
        if (sort === 'oldest') sortOption = { createdAt: 1 };


        const pageSize = Number(limit);
        const pageNum = Number(page);
        const skip = (pageNum - 1) * pageSize;

        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate('user', 'id name email phone')
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
        const validStatuses = [...ORDER_STATUSES];

        if (!validStatuses.includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }

        const order = await Order.findById(req.params.id).populate('user', 'name email phone');

        if (order) {
            const prevStatus = order.status;

            const allowedNext = ORDER_TRANSITIONS[prevStatus] || [];
            if (!allowedNext.includes(status)) {
                res.status(400).json({
                    message: `Invalid status transition from ${prevStatus} to ${status}`,
                    allowedNext,
                });
                return;
            }

            order.status = status;

            // Auto update deliveredAt
            if (status === 'delivered') {
                order.isDelivered = true;
                order.deliveredAt = new Date();
            } else if (prevStatus === 'delivered') {
                order.isDelivered = false;
                order.deliveredAt = undefined;
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

            type PopUser = { name?: string; email?: string; phone?: string } | null;
            const u = order.user as PopUser | undefined;
            const cust = order.customer as { name?: string; email?: string; phone?: string } | undefined;
            const customerEmail = (cust?.email || u?.email || '').trim().toLowerCase();
            const customerName = (cust?.name || u?.name || 'Customer').trim() || 'Customer';
            const customerPhone = (cust?.phone || u?.phone || '').trim();

            if (customerEmail) {
                const addr = updatedOrder.shippingAddress;
                const orderItemsForMail = (updatedOrder.orderItems || []).map((item) => ({
                    name: String(item.name),
                    qty: Number(item.qty),
                    price: Number(item.price),
                }));
                void sendOrderStatusUpdatedEmail({
                    orderId: String(updatedOrder._id),
                    customerName,
                    customerEmail,
                    customerPhone: cust?.phone?.trim() || undefined,
                    newStatus: status,
                    totalPrice: Number(updatedOrder.totalPrice),
                    paymentMethod: String(updatedOrder.paymentMethod),
                    shippingAddress: {
                        address: String(addr?.address ?? ''),
                        city: String(addr?.city ?? ''),
                        postalCode: String(addr?.postalCode ?? ''),
                        country: String(addr?.country ?? ''),
                    },
                    orderItems: orderItemsForMail,
                });
            }
            if (customerPhone) {
                void sendOrderStatusUpdatedWhatsApp({
                    customerName,
                    customerPhone,
                    orderId: String(updatedOrder._id),
                    status,
                });
            }

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
        const order = await Order.findById(req.params.id).populate('user', 'name email phone');
        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};
