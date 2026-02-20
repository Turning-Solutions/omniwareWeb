import { Request } from 'express';
import mongoose from 'mongoose';
import Brand from '../models/Brand';
import Category from '../models/Category';

export interface MatchStageCache {
    brandIds?: mongoose.Types.ObjectId[];
    categoryIds?: mongoose.Types.ObjectId[];
}

export const buildProductMatchStage = async (
    req: Request,
    exclude: string[] = [],
    cache?: MatchStageCache
) => {
    const { search, minPrice, maxPrice, brand, category, availability, inStock, ...dynamicFilters } = req.query;
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

    if (brand && !exclude.includes('brand')) {
        if (cache && 'brandIds' in cache && cache.brandIds !== undefined) {
            if (cache.brandIds.length > 0) matchStage.brandId = { $in: cache.brandIds };
        } else {
            const brands = (brand as string).split(',');
            const brandDocs = await Brand.find({
                $or: [
                    { slug: { $in: brands } },
                    { _id: { $in: brands.filter((b: string) => mongoose.Types.ObjectId.isValid(b)) } }
                ]
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
            const cats = (category as string).split(',');
            const catDocs = await Category.find({
                $or: [
                    { slug: { $in: cats } },
                    { _id: { $in: cats.filter((c: string) => mongoose.Types.ObjectId.isValid(c)) } }
                ]
            });
            const ids = catDocs.map((c) => c._id);
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
    Object.keys(req.query).forEach(key => {
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
