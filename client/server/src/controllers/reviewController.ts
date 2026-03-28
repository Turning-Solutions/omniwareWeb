import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Review from '../models/Review';
import Product from '../models/Product';

function parseLimit(raw: unknown, fallback: number, max: number): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(Math.floor(n), max);
}

function parsePage(raw: unknown): number {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
}

export async function getShopReviews(req: Request, res: Response) {
    try {
        const limit = parseLimit(req.query.limit, 24, 50);
        const reviews = await Review.find({
            kind: 'shop',
            status: 'approved',
        })
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
        res.set('Cache-Control', 'private, no-store, must-revalidate');
        res.json({ reviews });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to load reviews' });
    }
}

function paramId(raw: string | string[] | undefined): string {
    if (raw == null) return "";
    return Array.isArray(raw) ? raw[0] ?? "" : raw;
}

export async function getProductReviews(req: Request, res: Response) {
    try {
        const productId = paramId(req.params.productId);
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            res.status(400).json({ message: 'Invalid product id' });
            return;
        }
        const pageSize = parseLimit(req.query.pageSize, 5, 10);
        const pageRequested = parsePage(req.query.page);
        const objectId = new mongoose.Types.ObjectId(productId);
        const filter = {
            kind: 'product' as const,
            status: 'approved' as const,
            $or: [{ productId: objectId }, { productId }],
        };
        const total = await Review.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const page = Math.min(pageRequested, totalPages);
        const skip = (page - 1) * pageSize;

        const reviews = await Review.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize)
            .lean();
        res.set('Cache-Control', 'private, no-store, must-revalidate');
        res.json({ reviews, total, page, pageSize });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Failed to load reviews' });
    }
}

export async function createShopReview(req: Request, res: Response) {
    try {
        const { authorName, rating, comment } = req.body as {
            authorName?: string;
            rating?: number;
            comment?: string;
        };
        const name = String(authorName ?? '').trim();
        const text = String(comment ?? '').trim();
        const stars = Number(rating);
        if (!name || name.length > 100) {
            res.status(400).json({ message: 'Please enter your name (max 100 characters).' });
            return;
        }
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            res.status(400).json({ message: 'Rating must be between 1 and 5.' });
            return;
        }
        if (!text || text.length > 2000) {
            res.status(400).json({ message: 'Please write a review (max 2000 characters).' });
            return;
        }
        const doc = await Review.create({
            kind: 'shop',
            productId: null,
            rating: stars,
            authorName: name,
            comment: text,
            status: 'pending',
        });
        res.status(201).json({
            review: doc.toObject(),
            message: 'Thanks! Your review was submitted and will appear after approval.',
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Could not save review' });
    }
}

export async function createProductReview(req: Request, res: Response) {
    try {
        const productId = paramId(req.params.productId);
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            res.status(400).json({ message: 'Invalid product id' });
            return;
        }
        const product = await Product.findById(productId).select('_id').lean();
        if (!product) {
            res.status(404).json({ message: 'Product not found' });
            return;
        }
        const { authorName, rating, comment } = req.body as {
            authorName?: string;
            rating?: number;
            comment?: string;
        };
        const name = String(authorName ?? '').trim();
        const text = String(comment ?? '').trim();
        const stars = Number(rating);
        if (!name || name.length > 100) {
            res.status(400).json({ message: 'Please enter your name (max 100 characters).' });
            return;
        }
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
            res.status(400).json({ message: 'Rating must be between 1 and 5.' });
            return;
        }
        if (!text || text.length > 2000) {
            res.status(400).json({ message: 'Please write a review (max 2000 characters).' });
            return;
        }
        const doc = await Review.create({
            kind: 'product',
            productId: new mongoose.Types.ObjectId(productId),
            rating: stars,
            authorName: name,
            comment: text,
            status: 'pending',
        });
        res.status(201).json({
            review: doc.toObject(),
            message: 'Thanks! Your review was submitted and will appear after approval.',
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: 'Could not save review' });
    }
}
