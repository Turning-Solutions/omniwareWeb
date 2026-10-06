import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorMiddleware';
import { resolveCategory } from '../utils/categoryTree';
import AttributeNamingScheme from '../models/AttributeNamingScheme';
import {
    ProposalError,
    acceptProposal,
    acceptSafeProposals,
    buildProposals,
    getProposalDetail,
    listProposals,
    rejectProposal,
    revertProposal,
} from '../services/attributeProposals';
import { createAuditLog } from '../utils/audit';
import { ALL_PRODUCT_PAGES, CATALOG_LISTING_PATHS, triggerRevalidation } from '../utils/revalidate';
import { invalidateFacetCaches } from './productController';

/**
 * "Review products": build the per-product rename suggestions from the confirmed naming scheme, then
 * accept / leave unchanged / undo them one product at a time. Names only — values never change.
 */

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

function sendProposalError(error: unknown, res: Response, next: NextFunction) {
    if (error instanceof ProposalError) {
        res.status(error.status).json({ message: error.message });
        return;
    }
    next(error);
}

/** Product pages and shop filters are cached — refresh them after names change. */
const refreshSite = async (specRenamed: boolean) => {
    if (specRenamed) invalidateFacetCaches();
    await triggerRevalidation([...CATALOG_LISTING_PATHS, ALL_PRODUCT_PAGES]);
};

/** POST /:categoryKey/proposals/generate — build the per-product changes. */
export const generateProposals = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        res.json(await buildProposals(category));
    } catch (error) {
        sendProposalError(error, res, next);
    }
};

/** GET /:categoryKey/proposals — the review queue (light items). */
export const getProposalQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        const [items, scheme] = await Promise.all([
            listProposals(category._id),
            AttributeNamingScheme.findOne({ categoryId: category._id }, 'status').lean(),
        ]);
        res.set('Cache-Control', 'no-store');
        res.json({ items, schemeApproved: scheme?.status === 'approved' });
    } catch (error) {
        next(error);
    }
};

/** GET /proposal/:id */
export const getProposal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await getProposalDetail(paramOf(req, 'id')));
    } catch (error) {
        sendProposalError(error, res, next);
    }
};

const acceptSchema = z.object({
    edits: z.array(z.object({ index: z.number().int().min(0), newName: z.string().min(1).max(200) })).max(500).optional(),
});

/** POST /proposal/:id/accept  { edits?: [{ index, newName }] } */
export const acceptProposalEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = acceptSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
            res.status(400).json({ message: 'Invalid names.' });
            return;
        }
        const result = await acceptProposal(paramOf(req, 'id'), req.authUser?.email, parsed.data.edits);
        await createAuditLog(req, {
            action: 'ATTRIBUTE_RENAME_ACCEPT',
            entityType: 'Product',
            entityId: result.productId,
            before: result.changes.map((c) => c.oldName),
            after: result.changes.map((c) => c.newName),
        });
        await refreshSite(result.specRenamed);
        res.json({ ok: true });
    } catch (error) {
        sendProposalError(error, res, next);
    }
};

/** POST /proposal/:id/reject */
export const rejectProposalEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        await rejectProposal(paramOf(req, 'id'));
        res.json({ ok: true });
    } catch (error) {
        sendProposalError(error, res, next);
    }
};

/** POST /proposal/:id/revert — undo an accepted change. */
export const revertProposalEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const result = await revertProposal(paramOf(req, 'id'));
        await createAuditLog(req, {
            action: 'ATTRIBUTE_RENAME_REVERT',
            entityType: 'Product',
            entityId: result.productId,
            before: result.changes.map((c) => c.newName),
            after: result.changes.map((c) => c.oldName),
        });
        await refreshSite(result.specRenamed);
        res.json({ ok: true });
    } catch (error) {
        sendProposalError(error, res, next);
    }
};

const bulkSchema = z.object({ brand: z.string().max(200).optional() });

/** POST /:categoryKey/proposals/accept-safe — accept a batch of unremarkable ones (call again while `remaining` > 0). */
export const acceptSafeProposalsEndpoint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        const parsed = bulkSchema.safeParse(req.body ?? {});
        const result = await acceptSafeProposals(category._id, req.authUser?.email, { brand: parsed.success ? parsed.data.brand : undefined });
        for (const item of result.accepted) {
            await createAuditLog(req, {
                action: 'ATTRIBUTE_RENAME_ACCEPT',
                entityType: 'Product',
                entityId: item.productId,
                before: item.changes.map((c) => c.oldName),
                after: item.changes.map((c) => c.newName),
            });
        }
        if (result.accepted.length) await refreshSite(result.accepted.some((a) => a.specRenamed));
        res.json({ acceptedCount: result.accepted.length, failed: result.failed, remaining: result.remaining });
    } catch (error) {
        sendProposalError(error, res, next);
    }
};
