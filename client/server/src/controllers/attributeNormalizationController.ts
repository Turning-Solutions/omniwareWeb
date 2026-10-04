import { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errorMiddleware';
import { resolveCategory } from '../utils/categoryTree';
import { buildCategoryInventory } from '../services/attributeInventory';

function paramOf(req: Request, name: string): string {
    const raw = req.params[name];
    return Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
}

/** GET /admin/attribute-normalization/:categoryKey/inventory — read-only Phase 1 report. */
export const getCategoryInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) {
            const err: AppError = new Error('Category not found');
            err.code = 'CATEGORY_NOT_FOUND';
            err.status = 404;
            return next(err);
        }
        res.set('Cache-Control', 'no-store');
        res.json(await buildCategoryInventory(category));
    } catch (error) {
        next(error);
    }
};
