import { Request, Response } from 'express';
import { z } from 'zod';
import Promotion from '../models/Promotion';
import { AppError } from '../middleware/errorMiddleware';

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
        const candidates = await Promotion.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });

        const promotions = candidates.filter((promotion) => {
            const start = new Date(promotion.validFrom);
            const end = new Date(promotion.validTo);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;

            // If validTo is stored as midnight, treat it as "end of that date" to avoid premature expiry.
            if (
                end.getHours() === 0 &&
                end.getMinutes() === 0 &&
                end.getSeconds() === 0 &&
                end.getMilliseconds() === 0
            ) {
                end.setHours(23, 59, 59, 999);
            }

            return start <= now && end >= now;
        });

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
