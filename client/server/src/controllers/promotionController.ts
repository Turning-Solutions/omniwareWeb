import { Request, Response } from 'express';
import { z } from 'zod';
import Promotion from '../models/Promotion';
import { AppError } from '../middleware/errorMiddleware';

// Short in-memory cache to avoid re-querying the DB on every page load.
// This is safe because promotions only change occasionally (admin actions).
let activePromotionsCache:
    | {
        expiresAt: number;
        data: any[];
      }
    | undefined;

const promotionSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().default(''),
    imageUrl: z.string().default(''),
    link: z.string().default(''),
    badgeText: z.string().default(''),
    validFrom: z.string().refine(d => !isNaN(Date.parse(d)), { message: 'Invalid validFrom date' }),
    validTo: z.string().refine(d => !isNaN(Date.parse(d)), { message: 'Invalid validTo date' }),
    isActive: z.boolean().default(true),
    sortOrder: z.number().default(0),
});

const updateSchema = promotionSchema.partial();

// Public — returns only currently active & time-valid promotions
export const getActivePromotions = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const now = new Date();

        // Cache for 30s to keep the home page snappy.
        if (activePromotionsCache && Date.now() < activePromotionsCache.expiresAt) {
            res.json(activePromotionsCache.data);
            return;
        }

        // To keep this endpoint fast, first limit the candidate set using indexes.
        // We also use a small "sliding window" for validTo because date-only validTo values
        // are typically stored at midnight and are inclusive for the whole day.
        const nowMinusOneDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const candidates = await Promotion.find({
            isActive: true,
            validFrom: { $lte: now },
            validTo: { $gte: nowMinusOneDay },
        })
            .sort({ sortOrder: 1, createdAt: -1 })
            .select({
                title: 1,
                description: 1,
                imageUrl: 1,
                link: 1,
                badgeText: 1,
                validFrom: 1,
                validTo: 1,
            })
            .lean();

        const MAX_PROMOTIONS = 10;
        const promotions: any[] = [];

        for (const promotion of candidates) {
            const start = new Date(promotion.validFrom);
            const end = new Date(promotion.validTo);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

            // Timezone-safe "date-only validTo" handling: if the stored time is midnight in UTC,
            // treat it as the end of that UTC date.
            if (
                end.getUTCHours() === 0 &&
                end.getUTCMinutes() === 0 &&
                end.getUTCSeconds() === 0 &&
                end.getUTCMilliseconds() === 0
            ) {
                end.setUTCHours(23, 59, 59, 999);
            }

            if (start <= now && end >= now) {
                promotions.push(promotion);
                if (promotions.length >= MAX_PROMOTIONS) break;
            }
        }

        activePromotionsCache = {
            expiresAt: Date.now() + 30_000,
            data: promotions,
        };

        res.json(promotions);
    } catch (error) {
        next(error);
    }
};

// Admin — all promotions
export const getAllPromotions = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const promotions = await Promotion.find().sort({ createdAt: -1 });
        res.json(promotions);
    } catch (error) {
        next(error);
    }
};

export const createPromotion = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const result = promotionSchema.safeParse(req.body);
        if (!result.success) {
            const err: AppError = new Error('Invalid input');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            err.details = result.error.format();
            return next(err);
        }

        const { validFrom, validTo, ...rest } = result.data;
        const promotion = await Promotion.create({
            ...rest,
            validFrom: new Date(validFrom),
            validTo: new Date(validTo),
        });

        res.status(201).json(promotion);
    } catch (error) {
        next(error);
    }
};

export const updatePromotion = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const { id } = req.params;

        const result = updateSchema.safeParse(req.body);
        if (!result.success) {
            const err: AppError = new Error('Invalid input');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            err.details = result.error.format();
            return next(err);
        }

        const { validFrom, validTo, ...rest } = result.data;
        const update: Record<string, any> = { ...rest };
        if (validFrom) update.validFrom = new Date(validFrom);
        if (validTo) update.validTo = new Date(validTo);

        const promotion = await Promotion.findByIdAndUpdate(id, update, { new: true, runValidators: true });
        if (!promotion) {
            const err: AppError = new Error('Promotion not found');
            err.code = 'NOT_FOUND';
            err.status = 404;
            return next(err);
        }

        res.json(promotion);
    } catch (error) {
        next(error);
    }
};

export const deletePromotion = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const { id } = req.params;
        const promotion = await Promotion.findByIdAndDelete(id);
        if (!promotion) {
            const err: AppError = new Error('Promotion not found');
            err.code = 'NOT_FOUND';
            err.status = 404;
            return next(err);
        }
        res.json({ message: 'Promotion deleted' });
    } catch (error) {
        next(error);
    }
};
