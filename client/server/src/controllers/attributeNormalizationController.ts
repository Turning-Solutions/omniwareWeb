import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorMiddleware';
import { resolveCategory } from '../utils/categoryTree';
import { buildCategoryInventory } from '../services/attributeInventory';
import AttributeNamingScheme from '../models/AttributeNamingScheme';
import CategoryAttributeTemplate from '../models/CategoryAttributeTemplate';
import { attributeLooseKey } from '../../../lib/attributeMatchKey';
import { DEFAULT_CHUNK_SIZE, generateSchemeChunk, standardCanonical } from '../services/namingSchemeGenerator';
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
        standard: z.boolean().optional(),
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
        const [scheme, template] = await Promise.all([
            AttributeNamingScheme.findOne({ categoryId: category._id }).lean(),
            CategoryAttributeTemplate.findOne({ categoryId: category._id }).lean(),
        ]);
        res.set('Cache-Control', 'no-store');
        res.json({
            scheme,
            template: template?.attributes ?? [],
            geminiConfigured: isGeminiConfigured(),
            model: geminiModel(),
            chunkSize: DEFAULT_CHUNK_SIZE,
        });
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

const templateSchema = z.object({
    attributes: z.array(z.object({
        name: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).optional(),
    })).max(300),
});

/**
 * PUT /admin/attribute-normalization/:categoryKey/template — the category's standard attribute list.
 * Also syncs an existing naming scheme: standard names are added/marked, removed ones become non-standard.
 */
export const updateAttributeTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = templateSchema.safeParse(req.body);
        if (!parsed.success) {
            const err: AppError = new Error('Invalid attribute list');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            err.details = parsed.error.format();
            return next(err);
        }
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return categoryNotFound(next);

        const seen = new Set<string>();
        const attributes = parsed.data.attributes.filter((a) => {
            const key = attributeLooseKey(a.name);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const template = await CategoryAttributeTemplate.findOneAndUpdate(
            { categoryId: category._id },
            { $set: { categoryId: category._id, attributes } },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        ).lean();

        const scheme = await AttributeNamingScheme.findOne({ categoryId: category._id });
        if (scheme) {
            const standard = standardCanonical(attributes);
            const standardByLoose = new Map(standard.map((c) => [attributeLooseKey(c.name), c]));
            const current = (scheme.toObject() as unknown as { canonical: { id: string; name: string; description?: string; standard?: boolean }[] }).canonical;
            const matched = new Set<string>();
            const canonical: { id: string; name: string; description?: string; standard?: boolean }[] = current.map((c) => {
                const std = standardByLoose.get(attributeLooseKey(c.name));
                if (std) {
                    matched.add(attributeLooseKey(c.name));
                    return { ...c, name: std.name, description: std.description ?? c.description, standard: true };
                }
                return { ...c, standard: false };
            });
            const ids = new Set(canonical.map((c) => c.id));
            for (const std of standard) {
                if (matched.has(attributeLooseKey(std.name))) continue;
                let id = std.id;
                let n = 2;
                while (ids.has(id)) id = `${std.id}-${n++}`;
                ids.add(id);
                canonical.push({ ...std, id });
            }
            scheme.set({ canonical, status: 'draft', approvedAt: undefined, approvedBy: undefined });
            await scheme.save();
        }

        res.json({ template: template?.attributes ?? [], scheme: scheme?.toObject() ?? null });
    } catch (error) {
        next(error);
    }
};
