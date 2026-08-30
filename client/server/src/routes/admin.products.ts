import express, { Request, Response } from 'express';
import Product from '../models/Product';
import Brand from '../models/Brand';
import Category from '../models/Category';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { adminRateLimit } from '../middleware/adminRateLimit';
import { createAuditLog } from '../utils/audit';
import { clearFeaturedSpecsCache, invalidateFacetCaches } from '../controllers/productController';
import { triggerRevalidation } from '../utils/revalidate';
import { normalizeSpecKey } from '../utils/normalizeSpecKey';
import {
    backfillProductSlugs,
    createUniqueProductSlug,
    getProductSlug,
} from '../utils/productSlug';
import { createUniqueCategorySlug } from '../utils/categorySlug';

const router = express.Router();

router.use(requireAuth, requireAdmin, adminRateLimit);

async function hasProductsInCategory(categoryId: string): Promise<boolean> {
    const linkedProduct = await Product.exists({ categoryIds: categoryId });
    return Boolean(linkedProduct);
}

// GET /api/v1/admin/products
router.get('/', async (req: Request, res: Response) => {
    const { q, category, brand, isActive, isFeatured, page = '1', limit = '20' } = req.query;
    res.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
    res.vary('Authorization');

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Admin list should include both active and inactive products by default.
    // Optional filter can still be applied with ?isActive=true|false when needed.
    const match: Record<string, unknown> = {};
    if (typeof isActive === 'string' && (isActive === 'true' || isActive === 'false')) {
        match.isActive = isActive === 'true';
    }
    if (typeof isFeatured === 'string' && (isFeatured === 'true' || isFeatured === 'false')) {
        match.isFeatured = isFeatured === 'true';
    }
    if (q && String(q).trim()) {
        const term = String(q).trim();
        const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        match.$or = [
            { title: { $regex: safe, $options: 'i' } },
            { sku: { $regex: safe, $options: 'i' } },
            { 'variants.sku': { $regex: safe, $options: 'i' } },
        ];
    }
    if (brand && String(brand).trim()) {
        match.brandId = String(brand).trim();
    }
    if (category && String(category).trim()) {
        const categoryId = String(category).trim();
        // Selecting a main category should include products tagged with any of its subcategories.
        const subCategoryIds = await Category.find({ parentId: categoryId }).distinct('_id');
        match.categoryIds = subCategoryIds.length
            ? { $in: [categoryId, ...subCategoryIds.map((id) => String(id))] }
            : categoryId;
    }

    const [items, total] = await Promise.all([
        Product.find(match)
            .populate('brandId', 'name')
            .populate('categoryIds', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Product.countDocuments(match),
    ]);

    res.json({
        data: items,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
        },
    });
});

// POST /api/v1/admin/products/backfill-slugs
// Updates slugs for active and inactive products. Only active products appear in sitemap.xml.
router.post('/backfill-slugs', async (req: Request, res: Response) => {
    try {
        const dryRun = req.body?.dryRun === true;
        const activeOnly = req.body?.activeOnly === true;
        const result = await backfillProductSlugs({ dryRun, activeOnly });

        if (!dryRun && result.updated > 0) {
            invalidateFacetCaches();
            await triggerRevalidation(['/', '/shop', '/sitemap.xml']);
        }

        await createAuditLog(req, {
            action: 'BACKFILL_PRODUCT_SLUGS',
            entityType: 'Product',
            after: result,
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
});

// GET /api/v1/admin/products/:id
router.get('/:id', async (req: Request, res: Response) => {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
});

// Normalize body: empty SKU becomes undefined so sparse unique index allows multiple products without SKU
function normalizeProductBody(body: Record<string, unknown>): Record<string, unknown> {
    const b = { ...body };
    if (b.sku === '' || (typeof b.sku === 'string' && !b.sku.trim())) {
        delete b.sku;
    }
    if (b.slug === '' || (typeof b.slug === 'string' && !b.slug.trim())) {
        delete b.slug;
    }
    if (b.extendedWarranty && typeof b.extendedWarranty === 'object') {
        const ew = b.extendedWarranty as Record<string, unknown>;
        const duration = typeof ew.duration === 'string' ? ew.duration.trim() : '';
        if (!duration) {
            delete b.extendedWarranty;
        } else {
            b.extendedWarranty = {
                duration,
                description: typeof ew.description === 'string' ? ew.description.trim() : '',
            };
        }
    }
    return b;
}

function buildProductUpdate(body: Record<string, unknown>, slug: string): Record<string, unknown> {
    const normalized = normalizeProductBody(body);
    normalized.slug = slug;
    const unset: Record<string, 1> = {};

    if (body.sku === '' || (typeof body.sku === 'string' && !body.sku.trim())) {
        unset.sku = 1;
    }
    if (body.warranty === '' || (typeof body.warranty === 'string' && !body.warranty.trim())) {
        delete normalized.warranty;
        unset.warranty = 1;
    }
    const extendedWarrantyBody = body.extendedWarranty as Record<string, unknown> | undefined;
    const extendedWarrantyDuration =
        typeof extendedWarrantyBody?.duration === 'string' ? extendedWarrantyBody.duration.trim() : '';
    if (!extendedWarrantyDuration) {
        delete normalized.extendedWarranty;
        unset.extendedWarranty = 1;
    }
    if (Object.keys(unset).length === 0) {
        return normalized;
    }

    return {
        ...normalized,
        $unset: unset,
    };
}

// POST /api/v1/admin/products
router.post('/', async (req: Request, res: Response) => {
    try {
        const normalizedBody = normalizeProductBody(req.body);
        normalizedBody.slug = await createUniqueProductSlug(normalizedBody.slug || normalizedBody.title);
        const product = await Product.create(normalizedBody);
        invalidateFacetCaches();
        await triggerRevalidation(['/', '/shop', '/sitemap.xml']);

        await createAuditLog(req, {
            action: 'CREATE_PRODUCT',
            entityType: 'Product',
            entityId: product._id.toString(),
            after: product.toObject(),
        });

        res.status(201).json(product);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

// PATCH /api/v1/admin/products/:id
router.patch('/:id', async (req: Request, res: Response) => {
    const before = await Product.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: 'Product not found' });

    try {
        const normalizedBody = normalizeProductBody(req.body);
        const requestedSlug =
            normalizedBody.slug ||
            (typeof normalizedBody.title === "string" ? normalizedBody.title : before.title);
        const productSlugForUpdate =
            normalizedBody.slug || !getProductSlug(before)
                ? await createUniqueProductSlug(requestedSlug, String(req.params.id))
                : getProductSlug(before);
        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            buildProductUpdate(req.body, productSlugForUpdate),
            {
            returnDocument: 'after',
            runValidators: true,
            }
        ).lean();
        invalidateFacetCaches();
        const productSlug = getProductSlug(updated);
        const previousSlug = getProductSlug(before);
        await triggerRevalidation([
            '/',
            '/shop',
            '/sitemap.xml',
            ...(previousSlug ? [`/product/${previousSlug}`] : []),
            ...(productSlug ? [`/product/${productSlug}`] : []),
        ]);

        await createAuditLog(req, {
            action: 'UPDATE_PRODUCT',
            entityType: 'Product',
            entityId: req.params.id as string,
            before,
            after: updated,
        });

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

interface AttributeValueChange {
    field: 'spec' | 'attribute';
    key: string;
    groupName?: string;
    oldValue: string;
    newValue: string;
}

/**
 * Builds the Mongo filter/update for propagating one corrected spec or attribute
 * value to other products. Scoped to products sharing a category with the source
 * product, and always excludes the source product itself (it's saved separately
 * via the normal PATCH /:id flow).
 */
function buildAttributeChangeQuery(change: AttributeValueChange, categoryIds: string[], excludeId: string) {
    const baseFilter: Record<string, unknown> = {
        _id: { $ne: excludeId },
        categoryIds: { $in: categoryIds },
    };

    if (change.field === 'spec') {
        const specKey = normalizeSpecKey(change.key);
        return {
            filter: { ...baseFilter, [`specs.${specKey}`]: change.oldValue },
            update: { $set: { [`specs.${specKey}`]: change.newValue } },
            options: undefined as Record<string, unknown> | undefined,
        };
    }

    const groupName = (change.groupName || '').trim();
    const attrName = change.key.trim();
    return {
        filter: {
            ...baseFilter,
            attributeGroups: {
                $elemMatch: {
                    category: groupName,
                    attributes: { $elemMatch: { name: attrName, value: change.oldValue } },
                },
            },
        },
        update: { $set: { 'attributeGroups.$[grp].attributes.$[attr].value': change.newValue } },
        options: {
            arrayFilters: [
                { 'grp.category': groupName },
                { 'attr.name': attrName, 'attr.value': change.oldValue },
            ],
        },
    };
}

function parseAttributeValueChanges(rawChanges: unknown): AttributeValueChange[] {
    if (!Array.isArray(rawChanges)) return [];
    const changes: AttributeValueChange[] = [];
    for (const raw of rawChanges.slice(0, 50)) {
        const field = (raw as { field?: unknown })?.field;
        const key = typeof (raw as { key?: unknown })?.key === 'string' ? (raw as { key: string }).key.trim() : '';
        const groupName =
            typeof (raw as { groupName?: unknown })?.groupName === 'string'
                ? (raw as { groupName: string }).groupName.trim()
                : '';
        const oldValue =
            typeof (raw as { oldValue?: unknown })?.oldValue === 'string' ? (raw as { oldValue: string }).oldValue.trim() : '';
        const newValue =
            typeof (raw as { newValue?: unknown })?.newValue === 'string' ? (raw as { newValue: string }).newValue.trim() : '';

        if (field !== 'spec' && field !== 'attribute') continue;
        if (!key || !oldValue || !newValue || oldValue === newValue) continue;
        if (field === 'attribute' && !groupName) continue;

        changes.push({ field, key, groupName: field === 'attribute' ? groupName : undefined, oldValue, newValue });
    }
    return changes;
}

// POST /api/v1/admin/products/:id/propagate-attribute-changes
// After correcting a spec/attribute value on this product, checks (dryRun: true) or applies
// (dryRun: false) the same correction on other products in the same category(ies) that still
// carry the old, mistaken value — so a typo fixed on one item can be fixed everywhere at once.
router.post('/:id/propagate-attribute-changes', async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id).select('categoryIds').lean();
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const dryRun = req.body?.dryRun === true;
        const changes = parseAttributeValueChanges(req.body?.changes);
        if (changes.length === 0) {
            return res.status(400).json({ message: 'No valid changes provided' });
        }

        const categoryIds = (product.categoryIds || []).map((catId: unknown) => String(catId));
        const excludeId = String(req.params.id);
        const results: Array<AttributeValueChange & { matchedCount: number; modifiedCount: number }> = [];
        let anyModified = false;

        for (const change of changes) {
            const { filter, update, options } = buildAttributeChangeQuery(change, categoryIds, excludeId);
            if (dryRun) {
                const matchedCount = await Product.countDocuments(filter);
                results.push({ ...change, matchedCount, modifiedCount: 0 });
            } else {
                const result = await Product.updateMany(filter, update, options);
                if (result.modifiedCount > 0) anyModified = true;
                results.push({ ...change, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount });
            }
        }

        if (!dryRun && anyModified) {
            invalidateFacetCaches();
            await triggerRevalidation(['/', '/shop']);
            await createAuditLog(req, {
                action: 'BULK_UPDATE_ATTRIBUTE_VALUE',
                entityType: 'Product',
                entityId: excludeId,
                after: results,
            });
        }

        res.json({ results });
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

// DELETE /api/v1/admin/products/:id
router.delete('/:id', async (req: Request, res: Response) => {
    const before = await Product.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: 'Product not found' });

    await Product.findByIdAndDelete(req.params.id);
    invalidateFacetCaches();
    const productSlug = getProductSlug(before);
    await triggerRevalidation(['/', '/shop', '/sitemap.xml', ...(productSlug ? [`/product/${productSlug}`] : [])]);

    await createAuditLog(req, {
        action: 'DELETE_PRODUCT',
        entityType: 'Product',
        entityId: req.params.id as string,
        before,
    });

    res.status(204).send();
});

// --- Brands CRUD ---
router.post('/brands', async (req: Request, res: Response) => {
    try {
        const { name, slug, logoUrl } = req.body;
        const brand = await Brand.create({ name, slug, logoUrl, isActive: true });
        res.status(201).json(brand);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

router.put('/brands/:id', async (req: Request, res: Response) => {
    try {
        const brand = await Brand.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        if (!brand) return res.status(404).json({ message: 'Brand not found' });
        res.json(brand);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

// --- Categories CRUD ---
router.post('/categories', async (req: Request, res: Response) => {
    try {
        const { name, slug, parentId } = req.body;
        const normalizedName = typeof name === 'string' ? name.trim() : '';
        const normalizedSlug = await createUniqueCategorySlug(slug || normalizedName);
        const category = await Category.create({
            name: normalizedName,
            slug: normalizedSlug,
            parentId,
            isActive: true,
        });
        invalidateFacetCaches();
        await triggerRevalidation(['/', '/shop']);
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

router.put('/categories/:id', async (req: Request, res: Response) => {
    try {
        const categoryId = String(req.params.id || '');
        const existingCategory = await Category.findById(categoryId).lean();
        if (!existingCategory) return res.status(404).json({ message: 'Category not found' });

        const update: Record<string, unknown> = { ...req.body };
        if (typeof update.name === 'string') update.name = update.name.trim();
        if ('slug' in update || typeof update.name === 'string') {
            update.slug = await createUniqueCategorySlug(
                (typeof update.slug === 'string' && update.slug.trim()) ? update.slug : update.name,
                categoryId
            );
        }
        if ('parentId' in update) {
            const parentId = update.parentId ? String(update.parentId) : '';
            if (parentId && parentId === categoryId) {
                return res.status(400).json({ message: 'A category cannot be its own parent.' });
            }
        }

        const category = await Category.findByIdAndUpdate(categoryId, update, { returnDocument: 'after' });
        invalidateFacetCaches();
        await triggerRevalidation(['/', '/shop']);
        clearFeaturedSpecsCache(existingCategory.slug);
        if (category) {
            clearFeaturedSpecsCache(category.slug);
        }
        res.json(category);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

router.delete('/categories/:id', async (req: Request, res: Response) => {
    try {
        const categoryId = String(req.params.id || '');
        const category = await Category.findById(categoryId).lean();
        if (!category) return res.status(404).json({ message: 'Category not found' });

        const categoryHasProducts = await hasProductsInCategory(categoryId);
        if (categoryHasProducts) {
            return res.status(409).json({
                message: 'This category is linked to products and cannot be deleted.',
            });
        }

        const childCategories = await Category.find({ parentId: categoryId }).select('_id').lean();
        if (childCategories.length > 0) {
            const childCategoryIds = childCategories.map((child) => String(child._id));
            const childHasProducts = await Product.exists({ categoryIds: { $in: childCategoryIds } });
            if (childHasProducts) {
                return res.status(409).json({
                    message: 'One or more subcategories have linked products. Delete or reassign those products first.',
                });
            }
            await Category.deleteMany({ parentId: categoryId });
        }

        await Category.findByIdAndDelete(categoryId);
        invalidateFacetCaches();
        clearFeaturedSpecsCache(category.slug);
        await triggerRevalidation(['/', '/shop']);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

// PUT /api/v1/admin/products/categories/:id/discount
// Updates the category-wide discount amount that applies to all products in the category.
router.put('/categories/:id/discount', async (req: Request, res: Response) => {
    try {
        const { discountPercent } = req.body as { discountPercent?: number | string | null };

        const before = await Category.findById(req.params.id).lean();
        if (!before) return res.status(404).json({ message: 'Category not found' });

        let normalized: number | null = null;
        if (discountPercent == null || discountPercent === '') {
            normalized = null;
        } else {
            const n = Number(discountPercent);
            if (!Number.isFinite(n)) {
                return res.status(400).json({ message: 'discountPercent must be a non-negative number or null' });
            }
            if (n < 0) {
                return res.status(400).json({ message: 'discountPercent must be 0 or greater' });
            }
            normalized = Math.max(0, n);
        }

        const updated = await Category.findByIdAndUpdate(
            req.params.id,
            { discountPercent: normalized },
            { returnDocument: 'after' }
        ).lean();
        invalidateFacetCaches();
        await triggerRevalidation(['/', '/shop']);

        await createAuditLog(req, {
            action: 'UPDATE_CATEGORY_DISCOUNT',
            entityType: 'Category',
            entityId: String(req.params.id),
            before,
            after: updated,
        });

        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

export default router;
