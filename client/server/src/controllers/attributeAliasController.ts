import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Product from '../models/Product';
import Category from '../models/Category';
import CategoryAttributeAlias from '../models/CategoryAttributeAlias';
import { AppError } from '../middleware/errorMiddleware';
import { attributeMatchKey } from '../utils/attributeMatchKey';

const updateAliasesSchema = z.object({
    groups: z.array(z.object({
        canonical: z.string().trim().min(1).max(120),
        aliases: z.array(z.string().trim().min(1).max(120)).max(100),
    })).max(500),
});

function paramOf(req: Request, name: string): string {
    const raw = req.params[name];
    return Array.isArray(raw) ? raw[0] ?? '' : raw ?? '';
}

function notFound(next: NextFunction, message = 'Category not found') {
    const err: AppError = new Error(message);
    err.code = 'CATEGORY_NOT_FOUND';
    err.status = 404;
    return next(err);
}

async function resolveCategory(categoryKey: string) {
    if (mongoose.isValidObjectId(categoryKey)) {
        const byId = await Category.findById(categoryKey);
        if (byId) return byId;
    }
    return Category.findOne({ slug: categoryKey });
}

/** The category plus every descendant — products are often tagged only with a subcategory. */
async function getCategoryTreeIds(rootId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId[]> {
    const all = await Category.find({}, '_id parentId').lean<{ _id: mongoose.Types.ObjectId; parentId?: mongoose.Types.ObjectId | null }[]>();
    const childrenByParent = new Map<string, mongoose.Types.ObjectId[]>();
    for (const c of all) {
        if (!c.parentId) continue;
        const key = String(c.parentId);
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key)!.push(c._id);
    }
    const ids: mongoose.Types.ObjectId[] = [rootId];
    const seen = new Set([String(rootId)]);
    for (let i = 0; i < ids.length; i++) {
        for (const child of childrenByParent.get(String(ids[i])) ?? []) {
            if (seen.has(String(child))) continue;
            seen.add(String(child));
            ids.push(child);
        }
    }
    return ids;
}

/** Drop empty/duplicate aliases and make sure no alias belongs to two groups. */
function sanitizeGroups(groups: { canonical: string; aliases: string[] }[]) {
    const claimed = new Set<string>();
    const out: { canonical: string; aliases: string[] }[] = [];
    for (const group of groups) {
        const aliases: string[] = [];
        for (const alias of [group.canonical, ...group.aliases]) {
            const key = attributeMatchKey(alias);
            if (!key || claimed.has(key)) continue;
            claimed.add(key);
            aliases.push(alias.trim());
        }
        // A single alias is still useful: it renames that attribute on the compare page.
        if (aliases.length === 0) continue;
        out.push({ canonical: group.canonical.trim(), aliases });
    }
    return out;
}

/**
 * GET /products/attribute-aliases?categoryIds=a,b,c   (or /products/attribute-aliases/:categoryId)
 * Public, used by the compare page. Each id is walked up to its main category, so the
 * caller can pass any category the compared products belong to.
 */
export const getPublicAttributeAliases = async (req: Request, res: Response) => {
    try {
        res.set('Cache-Control', 'no-store');
        const fromQuery = typeof req.query.categoryIds === 'string' ? req.query.categoryIds.split(',') : [];
        const requested = [...fromQuery, paramOf(req, 'categoryId')]
            .map((id) => id.trim())
            .filter((id) => mongoose.isValidObjectId(id));
        if (requested.length === 0) {
            res.json({ groups: [] });
            return;
        }

        const all = await Category.find({}, '_id parentId').lean<{ _id: mongoose.Types.ObjectId; parentId?: mongoose.Types.ObjectId | null }[]>();
        const parentOf = new Map(all.map((c) => [String(c._id), c.parentId ? String(c.parentId) : null]));
        const roots = new Set<string>();
        for (const id of requested) {
            let current: string | null = id;
            const seen = new Set<string>();
            while (current && parentOf.get(current) && !seen.has(current)) {
                seen.add(current);
                current = parentOf.get(current) ?? null;
            }
            if (current) roots.add(current);
        }

        const configs = await CategoryAttributeAlias.find({ categoryId: { $in: [...roots] } }).lean();
        res.json({ groups: configs.flatMap((c) => c.groups ?? []) });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

/**
 * GET /admin/categories/:categoryKey/attribute-names
 * Every spec key and attribute name used by products in this category tree,
 * grouped by match key, with usage counts and a few sample values.
 */
export const getCategoryAttributeNames = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return notFound(next);

        const categoryIds = await getCategoryTreeIds(category._id);
        const products = await Product.find(
            { categoryIds: { $in: categoryIds } },
            'specs attributeGroups attributes'
        ).lean<{
            _id: mongoose.Types.ObjectId;
            specs?: Record<string, string>;
            attributeGroups?: { category?: string; attributes?: { name?: string; value?: string }[] }[];
            attributes?: { name?: string; value?: string }[];
        }[]>();

        type Entry = {
            key: string;
            names: Map<string, number>;
            productIds: Set<string>;
            sources: Set<'spec' | 'attribute'>;
            groups: Set<string>;
            samples: Set<string>;
        };
        const entries = new Map<string, Entry>();

        const record = (name: string, value: unknown, productId: string, source: 'spec' | 'attribute', group?: string) => {
            const key = attributeMatchKey(name);
            if (!key) return;
            let entry = entries.get(key);
            if (!entry) {
                entry = { key, names: new Map(), productIds: new Set(), sources: new Set(), groups: new Set(), samples: new Set() };
                entries.set(key, entry);
            }
            const display = source === 'spec' ? name.replace(/_/g, ' ') : name.trim();
            entry.names.set(display, (entry.names.get(display) ?? 0) + 1);
            entry.productIds.add(productId);
            entry.sources.add(source);
            if (group) entry.groups.add(group.trim());
            const sample = String(value ?? '').trim();
            if (sample && entry.samples.size < 3) entry.samples.add(sample.length > 80 ? `${sample.slice(0, 77)}…` : sample);
        };

        for (const p of products) {
            const id = String(p._id);
            for (const [k, v] of Object.entries(p.specs ?? {})) record(k, v, id, 'spec');
            const groups = p.attributeGroups?.length
                ? p.attributeGroups
                : p.attributes?.length
                    ? [{ category: 'General', attributes: p.attributes }]
                    : [];
            for (const g of groups) {
                for (const attr of g.attributes ?? []) {
                    if (attr?.name) record(attr.name, attr.value, id, 'attribute', g.category);
                }
            }
        }

        const attributes = Array.from(entries.values())
            .map((e) => ({
                key: e.key,
                // Most-used spelling is the one we show.
                name: Array.from(e.names.entries()).sort((a, b) => b[1] - a[1])[0][0],
                variants: Array.from(e.names.keys()),
                productCount: e.productIds.size,
                sources: Array.from(e.sources),
                groups: Array.from(e.groups),
                samples: Array.from(e.samples),
            }))
            .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name));

        res.json({ categoryId: String(category._id), categoryName: category.name, productCount: products.length, attributes });
    } catch (error) {
        next(error);
    }
};

/** GET /admin/categories/:categoryKey/attribute-aliases */
export const getAttributeAliases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return notFound(next);
        const config = await CategoryAttributeAlias.findOne({ categoryId: category._id }).lean();
        res.json({ categoryId: String(category._id), groups: config?.groups ?? [] });
    } catch (error) {
        next(error);
    }
};

/** PUT /admin/categories/:categoryKey/attribute-aliases */
export const updateAttributeAliases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const parsed = updateAliasesSchema.safeParse(req.body);
        if (!parsed.success) {
            const err: AppError = new Error('Invalid input');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            err.details = parsed.error.format();
            return next(err);
        }
        const category = await resolveCategory(paramOf(req, 'categoryKey'));
        if (!category) return notFound(next);

        const groups = sanitizeGroups(parsed.data.groups);
        const config = await CategoryAttributeAlias.findOneAndUpdate(
            { categoryId: category._id },
            { categoryId: category._id, groups },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        ).lean();

        res.json({ categoryId: String(category._id), groups: config?.groups ?? [] });
    } catch (error) {
        next(error);
    }
};
