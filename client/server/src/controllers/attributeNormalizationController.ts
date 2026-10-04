import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorMiddleware';
import { resolveCategory } from '../utils/categoryTree';
import { buildCategoryInventory } from '../services/attributeInventory';
import AttributeNamingScheme from '../models/AttributeNamingScheme';
import { DEFAULT_CHUNK_SIZE, generateSchemeChunk } from '../services/namingSchemeGenerator';
import { GeminiError, geminiModel, isGeminiConfigured } from '../services/gemini';
import type { NamingRule } from '../../../lib/attributeNamingRules';

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

/** GET /admin/attribute-normalization/:categoryKey/inventory — read-only Phase 1 report. */
export const getCategoryInventory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        res.set('Cache-Control', 'no-store');
        res.json(await buildCategoryInventory(category));
    } catch (error) {
        next(error);
    }
};

const ruleSchema = z.object({
    key: z.string().min(1).max(200),
    canonicalId: z.string().min(1).max(200).nullable(),
    signatures: z.array(z.string().max(100)).max(50).optional(),
    brands: z.array(z.string().max(120)).max(100).optional(),
    confidence: z.enum(['high', 'medium', 'low']),
    reason: z.string().max(500).optional(),
    source: z.enum(['ai', 'admin']),
});

const schemeUpdateSchema = z.object({
    canonical: z.array(z.object({
        id: z.string().min(1).max(200),
        name: z.string().trim().min(1).max(120),
        description: z.string().max(500).optional(),
    })).max(1000),
    rules: z.array(ruleSchema).max(5000),
    unresolved: z.array(z.object({ key: z.string().min(1).max(200), note: z.string().max(500) })).max(2000),
});

/** Problems that block approval: rules pointing at missing canonical names, or same-scope rules that disagree. */
function schemeProblems(scheme: { canonical: { id: string }[]; rules: NamingRule[] }): string[] {
    const ids = new Set(scheme.canonical.map((c) => c.id));
    const problems: string[] = [];
    for (const r of scheme.rules) {
        if (r.canonicalId && !ids.has(r.canonicalId)) problems.push(`Rule for "${r.key}" points to a missing name (${r.canonicalId}).`);
    }
    const seen = new Map<string, string>();
    for (const r of scheme.rules) {
        const sigs = [...(r.signatures ?? [])].sort().join(',');
        const brands = [...(r.brands ?? [])].map((b) => b.toLowerCase()).sort().join(',');
        const scope = `${r.key}|${sigs}|${brands}`;
        const target = r.canonicalId ?? '(keep)';
        const prev = seen.get(scope);
        if (prev !== undefined && prev !== target) problems.push(`"${r.key}" has conflicting rules for the same values.`);
        seen.set(scope, target);
    }
    return problems;
}

/** GET /admin/attribute-normalization/:categoryKey/scheme */
export const getNamingScheme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        const scheme = await AttributeNamingScheme.findOne({ categoryId: category._id }).lean();
        res.set('Cache-Control', 'no-store');
        res.json({ scheme, geminiConfigured: isGeminiConfigured(), model: geminiModel(), chunkSize: DEFAULT_CHUNK_SIZE });
    } catch (error) {
        next(error);
    }
};

/** POST /admin/attribute-normalization/:categoryKey/scheme/generate  { chunkIndex } — one LLM call per request. */
export const generateNamingSchemeChunk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        if (!isGeminiConfigured()) {
            res.status(400).json({ message: 'GEMINI_API_KEY is not set on the server.' });
            return;
        }
        const chunkIndex = Number(req.body?.chunkIndex ?? 0);
        if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
            res.status(400).json({ message: 'Invalid chunkIndex.' });
            return;
        }
        res.json(await generateSchemeChunk({ category, chunkIndex }));
    } catch (error) {
        if (error instanceof GeminiError) {
            res.status(error.status === 429 ? 429 : 502).json({ message: error.message });
            return;
        }
        next(error);
    }
};

/** PUT /admin/attribute-normalization/:categoryKey/scheme — save admin edits (always back to draft). */
export const updateNamingScheme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = schemeUpdateSchema.safeParse(req.body);
        if (!parsed.success) {
            const err: AppError = new Error('Invalid naming scheme');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            err.details = parsed.error.format();
            return next(err);
        }
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);

        const scheme = await AttributeNamingScheme.findOneAndUpdate(
            { categoryId: category._id },
            {
                $set: {
                    categoryId: category._id,
                    status: 'draft',
                    canonical: parsed.data.canonical,
                    rules: parsed.data.rules,
                    unresolved: parsed.data.unresolved,
                },
                $unset: { approvedAt: 1, approvedBy: 1 },
            },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        ).lean();
        res.json({ scheme, problems: schemeProblems(parsed.data) });
    } catch (error) {
        next(error);
    }
};

/** POST /admin/attribute-normalization/:categoryKey/scheme/approve */
export const approveNamingScheme = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);
        const scheme = await AttributeNamingScheme.findOne({ categoryId: category._id });
        if (!scheme) {
            res.status(404).json({ message: 'No naming scheme to approve. Generate one first.' });
            return;
        }
        const problems = schemeProblems(scheme.toObject() as unknown as { canonical: { id: string }[]; rules: NamingRule[] });
        if (problems.length) {
            res.status(400).json({ message: 'Fix these problems before approving.', problems });
            return;
        }
        scheme.set({ status: 'approved', approvedAt: new Date(), approvedBy: req.authUser?.email });
        await scheme.save();
        res.json({ scheme: scheme.toObject() });
    } catch (error) {
        next(error);
    }
};
