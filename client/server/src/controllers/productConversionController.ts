import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorMiddleware';
import { resolveCategory } from '../utils/categoryTree';
import CategoryAttributeTemplate from '../models/CategoryAttributeTemplate';
import { AiError } from '../services/aiError';
import { describeActiveAi, getActiveAi } from '../services/aiProviders';
import {
    ConversionError,
    approveConversion,
    getConversionDetail,
    listConversions,
    processNextBatch,
    queueConversions,
    redoConversion,
    repairLegacyCopies,
    skipConversion,
    undoConversion,
    usedFieldValues,
} from '../services/productConversion';
import ProductConversion from '../models/ProductConversion';
import Category from '../models/Category';
import { createAuditLog } from '../utils/audit';
import { ALL_PRODUCT_PAGES, CATALOG_LISTING_PATHS, triggerRevalidation } from '../utils/revalidate';
import { invalidateFacetCaches } from './productController';

/** "Convert products": AI fills each product's standard details; the admin approves product by product. */

function paramOf(req: Request, name: string): string {
    const raw = req.params[name];
    return Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
}

function categoryNotFound(next: NextFunction) {
    const err: AppError = new Error('Category not found');
    err.code = 'CATEGORY_NOT_FOUND';
    err.status = 404;
    return next(err);
}

/** Same error shape the naming-scheme AI step uses, so the page can pace / retry the same way. */
function sendError(error: unknown, res: Response, next: NextFunction) {
    if (error instanceof ConversionError) {
        res.status(error.status).json({ message: error.message });
        return;
    }
    if (error instanceof AiError) {
        const quotaExhausted = Boolean(error.quotaExhausted);
        const retryable = !quotaExhausted && (error.status === undefined || error.status === 429 || error.status >= 500);
        res.status(error.status === 429 ? 429 : 502).json({ message: error.message, retryable, quotaExhausted, retryAfterSeconds: error.retryAfterSeconds });
        return;
    }
    next(error);
}

const refreshSite = async () => {
    invalidateFacetCaches();
    await triggerRevalidation([...CATALOG_LISTING_PATHS, ALL_PRODUCT_PAGES]);
};

/** GET /:categoryKey/template */
export const getAttributeTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        const template = await CategoryAttributeTemplate.findOne({ categoryId: category._id }).lean();
        res.set('Cache-Control', 'no-store');
        res.json({ attributes: template?.attributes ?? [] });
    } catch (error) {
        next(error);
    }
};

/** GET /:categoryKey/conversions — queue for the review screen, plus the active AI. */
export const getConversionQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        const [items, template, active] = await Promise.all([
            listConversions(category._id),
            CategoryAttributeTemplate.findOne({ categoryId: category._id }, 'attributes').lean(),
            getActiveAi(),
        ]);
        res.set('Cache-Control', 'no-store');
        res.json({ items, templateCount: template?.attributes?.length ?? 0, ai: describeActiveAi(active) });
    } catch (error) {
        next(error);
    }
};

/** POST /:categoryKey/conversions/start  { redoAll? } — put products in the AI queue. */
export const startConversions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        res.json(await queueConversions(category, { redoAll: req.body?.redoAll === true }));
    } catch (error) {
        sendError(error, res, next);
    }
};

/** POST /:categoryKey/conversions/next — one AI request for the next few queued products. */
export const nextConversions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        res.json(await processNextBatch(category));
    } catch (error) {
        sendError(error, res, next);
    }
};

/** GET /conversion/:id */
export const getConversion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await getConversionDetail(paramOf(req, 'id')));
    } catch (error) {
        sendError(error, res, next);
    }
};

/** POST /conversion/:id/redo — ask the AI again for this one product. */
export const redoConversionEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const conv = await ProductConversion.findById(paramOf(req, 'id'), 'categoryId').lean();
        if (!conv) {
            res.status(404).json({ message: 'This product is no longer in the list.' });
            return;
        }
        const category = await Category.findById(conv.categoryId);
        if (!category) return categoryNotFound(next);
        await redoConversion(paramOf(req, 'id'), category);
        res.json(await getConversionDetail(paramOf(req, 'id')));
    } catch (error) {
        sendError(error, res, next);
    }
};

const approveSchema = z.object({
    fields: z.array(z.object({ name: z.string().min(1).max(200), sourceId: z.string().max(200).optional(), value: z.string().max(1000).optional() })).max(200).optional(),
    keep: z.array(z.string().max(100)).max(1000).optional(),
});

/** POST /conversion/:id/approve  { fields?: [{ name, sourceId } | { name, value }], keep?: [ids] } — picked details are copied as stored, typed values used as typed. */
export const approveConversionEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = approveSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            res.status(400).json({ message: 'Invalid values.' });
            return;
        }
        const result = await approveConversion(paramOf(req, 'id'), req.authUser?.email, parsed.data);
        await createAuditLog(req, {
            action: 'PRODUCT_DETAILS_CONVERT',
            entityType: 'Product',
            entityId: result.productId,
            before: result.before,
            after: result.after,
        });
        await refreshSite();
        res.json({ ok: true });
    } catch (error) {
        sendError(error, res, next);
    }
};

/** POST /conversion/:id/skip — leave the product unchanged. */
export const skipConversionEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await skipConversion(paramOf(req, 'id'));
        res.json({ ok: true });
    } catch (error) {
        sendError(error, res, next);
    }
};

/** POST /conversion/:id/undo — restore the product's previous details. */
export const undoConversionEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await undoConversion(paramOf(req, 'id'));
        await createAuditLog(req, { action: 'PRODUCT_DETAILS_CONVERT_UNDO', entityType: 'Product', entityId: result.productId });
        await refreshSite();
        res.json({ ok: true });
    } catch (error) {
        sendError(error, res, next);
    }
};

/** POST /:categoryKey/conversions/repair — clear old hidden detail copies left on already-approved products. */
export const repairConversions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        const fixed = await repairLegacyCopies(category._id);
        if (fixed) await refreshSite();
        res.json({ fixed });
    } catch (error) {
        sendError(error, res, next);
    }
};

/** GET /:categoryKey/conversions/values — values already used per standard field (typing suggestions). */
export const getUsedFieldValues = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        res.set('Cache-Control', 'no-store');
        res.json({ values: await usedFieldValues(category._id) });
    } catch (error) {
        next(error);
    }
};
