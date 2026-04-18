import { Request } from 'express';
import mongoose from 'mongoose';
import Brand from '../models/Brand';
import Category from '../models/Category';

/**
 * When filtering by a parent category (e.g. slug `storage`), include every
 * descendant `_id` so products tagged only with leaf categories still match
 * and facet aggregations expose those leaf slugs.
 */
async function expandCategoryTreeIds(
    rootIds: mongoose.Types.ObjectId[]
): Promise<mongoose.Types.ObjectId[]> {
    if (rootIds.length === 0) return [];
    const out = new Set<string>(rootIds.map((id) => String(id)));
    let frontier = [...rootIds];
    for (let depth = 0; depth < 64 && frontier.length > 0; depth++) {
        const children = await Category.find({ parentId: { $in: frontier } })
            .select('_id')
            .lean();
        const next: mongoose.Types.ObjectId[] = [];
        for (const row of children) {
            const sid = String(row._id);
            if (!out.has(sid)) {
                out.add(sid);
                next.push(row._id as mongoose.Types.ObjectId);
            }
        }
        frontier = next;
    }
    return [...out].map((s) => new mongoose.Types.ObjectId(s));
}

export interface MatchStageCache {
    brandIds?: mongoose.Types.ObjectId[];
    categoryIds?: mongoose.Types.ObjectId[];
}

/** $objectToArray errors on null/missing/non-document specs; coerce to {} first. */
export const SPECS_OBJECT_TO_ARRAY_PROJECT = {
    $project: {
        specs: {
            $objectToArray: {
                $cond: {
                    if: { $eq: [{ $type: '$specs' }, 'object'] },
                    then: '$specs',
                    else: {},
                },
            },
        },
    },
} as const;

export const buildProductMatchStage = async (
    req: Request,
    exclude: string[] = [],
    cache?: MatchStageCache
) => {
    const { search, minPrice, maxPrice, brand, category, availability, inStock, isFeatured, ...dynamicFilters } = req.query;
    const matchStage: any = { isActive: true };

    if (search && !exclude.includes('search')) {
        matchStage.title = { $regex: search, $options: 'i' };
    }

    if ((minPrice || maxPrice) && !exclude.includes('price')) {
        matchStage.price = {};
        if (minPrice) matchStage.price.$gte = Number(minPrice);
        if (maxPrice) matchStage.price.$lte = Number(maxPrice);
    }

    if (inStock === 'true' && !exclude.includes('inStock')) {
        matchStage['stock.qty'] = { $gt: 0 };
    }

    if (availability && !exclude.includes('availability')) {
        const availabilities = (availability as string).split(',');
        matchStage.availability = { $in: availabilities };
    }

    if (typeof isFeatured === 'string' && !exclude.includes('isFeatured')) {
        if (isFeatured === 'true' || isFeatured === 'false') {
            matchStage.isFeatured = isFeatured === 'true';
        }
    }

    if (brand && !exclude.includes('brand')) {
        if (cache && 'brandIds' in cache && cache.brandIds !== undefined) {
            if (cache.brandIds.length > 0) matchStage.brandId = { $in: cache.brandIds };
        } else {
            const brands = (brand as string).split(',');
            const brandDocs = await Brand.find({
                $or: [
                    { slug: { $in: brands } },
                    { _id: { $in: brands.filter((b: string) => mongoose.Types.ObjectId.isValid(b)) } },
                ],
            });
            const ids = brandDocs.map((b) => b._id);
            if (cache) cache.brandIds = ids;
            if (ids.length > 0) matchStage.brandId = { $in: ids };
        }
    }

    if (category && !exclude.includes('category')) {
        if (cache && 'categoryIds' in cache && cache.categoryIds !== undefined) {
            if (cache.categoryIds.length > 0) matchStage.categoryIds = { $in: cache.categoryIds };
        } else {
            const cats = (category as string).split(',').map((c) => c.trim()).filter(Boolean);
            const objectIds = cats.filter((c: string) => mongoose.Types.ObjectId.isValid(c));
            const slugParts = cats.filter((c: string) => !mongoose.Types.ObjectId.isValid(c)).map((c) => c.toLowerCase());
            const catDocs = await Category.find({
                $or: [{ slug: { $in: slugParts } }, { _id: { $in: objectIds } }],
            });
            const rootIds = catDocs.map((c) => c._id);
            const ids = await expandCategoryTreeIds(rootIds);
            if (cache) cache.categoryIds = ids;
            if (ids.length > 0) matchStage.categoryIds = { $in: ids };
        }
    }

    // Handle Dynamic Spec Filters
    // Support two formats:
    // 1. Nested object: ?spec[vram]=12GB&spec[chipset]=RTX 4070
    // 2. Direct keys (optional, but nested is safer for namespace)
    let specsFilter: Record<string, any> = (req.query as any).spec || {};

    // Fallback for flat keys (e.g. spec[vram]) if nested parsing didn't happen
    Object.keys(req.query).forEach((key) => {
        if (key.startsWith('spec[')) {
            const match = key.match(/spec\[(.*?)\]/);
            if (match && match[1]) {
                specsFilter[match[1]] = req.query[key];
            }
        }
    });

    if (Object.keys(specsFilter).length > 0 && !exclude.includes('specs')) {
        Object.entries(specsFilter).forEach(([key, value]) => {
            if (!value) return;
            const values = Array.isArray(value) ? value : (value as string).split(',');
            matchStage[`specs.${key}`] = { $in: values };
        });
    }

    return matchStage;
};
