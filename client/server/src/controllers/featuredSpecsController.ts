import { Request, Response } from 'express';
import { z } from 'zod';
import Product from '../models/Product';
import CategoryFeaturedSpecs from '../models/CategoryFeaturedSpecs';
import Category from '../models/Category';
import { normalizeSpecKey } from '../utils/normalizeSpecKey';
import { SPECS_OBJECT_TO_ARRAY_PROJECT } from '../utils/productAggregation';
import { AppError } from '../middleware/errorMiddleware';
import { clearFeaturedSpecsCache, invalidateFacetCaches } from './productController';

const updateFeaturedSpecsSchema = z.object({
    featuredSpecKeys: z.array(z.string()),
});

export const getAvailableSpecKeys = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const categoryKeyRaw = req.params.categoryKey;
        const categoryKey = Array.isArray(categoryKeyRaw) ? categoryKeyRaw[0] : categoryKeyRaw;

        const category = await Category.findOne({ slug: categoryKey });
        if (!category) {
            const err: AppError = new Error('Category not found');
            err.code = 'CATEGORY_NOT_FOUND';
            err.status = 404;
            return next(err);
        }

        const pipeline = [
            { $match: { categoryIds: category._id } },
            SPECS_OBJECT_TO_ARRAY_PROJECT,
            { $unwind: "$specs" },
            { $group: { _id: "$specs.k" } },
            { $sort: { _id: 1 } }
        ];

        const results = await Product.aggregate(pipeline as any);
        // Normalize any keys retrieved from db to match the standard
        const rawKeys = results.map(r => r._id);
        const specKeys = [...new Set(rawKeys.map(normalizeSpecKey))].filter(Boolean);

        res.json({
            categoryKey,
            availableSpecKeys: specKeys
        });
    } catch (error) {
        next(error);
    }
};

export const getFeaturedSpecs = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const categoryKeyRaw = req.params.categoryKey;
        const categoryKey = Array.isArray(categoryKeyRaw) ? categoryKeyRaw[0] : categoryKeyRaw;

        const config = await CategoryFeaturedSpecs.findOne({ categoryKey });

        let mode = 'default_all';
        let featuredSpecKeys: string[] = [];

        if (config) {
            featuredSpecKeys = config.featuredSpecKeys;
            mode = featuredSpecKeys.length > 0 ? 'restricted' : 'none';
        }

        // If there are featured keys, fetch all distinct values in a single aggregation
        let specValues: Record<string, string[]> = {};
        if (featuredSpecKeys.length > 0) {
            const category = await Category.findOne({ slug: categoryKey });
            if (category) {
                const pipeline = [
                    { $match: { categoryIds: category._id, isActive: true } },
                    SPECS_OBJECT_TO_ARRAY_PROJECT,
                    { $unwind: '$specs' },
                    { $match: { 'specs.k': { $in: featuredSpecKeys } } },
                    { $group: { _id: { k: '$specs.k', v: '$specs.v' } } },
                    { $sort: { '_id.v': 1 } },
                    { $group: { _id: '$_id.k', values: { $push: '$_id.v' } } },
                ];
                const results = await Product.aggregate(pipeline as any);
                results.forEach((r: { _id: string; values: string[] }) => {
                    specValues[r._id] = r.values.filter(Boolean);
                });
            }
        }

        res.json({ categoryKey, featuredSpecKeys, mode, specValues });
    } catch (error) {
        next(error);
    }
};

export const updateFeaturedSpecs = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const categoryKeyRaw = req.params.categoryKey;
        const categoryKey = Array.isArray(categoryKeyRaw) ? categoryKeyRaw[0] : categoryKeyRaw;

        const result = updateFeaturedSpecsSchema.safeParse(req.body);
        if (!result.success) {
            const err: AppError = new Error('Invalid input');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            err.details = result.error.format();
            return next(err);
        }

        const category = await Category.findOne({ slug: categoryKey });
        if (!category) {
            const err: AppError = new Error('Category not found');
            err.code = 'CATEGORY_NOT_FOUND';
            err.status = 404;
            return next(err);
        }

        const normalizedKeys = [...new Set(result.data.featuredSpecKeys.map(normalizeSpecKey))].filter(Boolean);

        const config = await CategoryFeaturedSpecs.findOneAndUpdate(
            { categoryKey },
            {
                categoryKey,
                featuredSpecKeys: normalizedKeys
            },
            { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
        );
        clearFeaturedSpecsCache(categoryKey);
        invalidateFacetCaches();

        let mode = 'default_all';
        if (config) {
            mode = config.featuredSpecKeys.length > 0 ? 'restricted' : 'none';
        }

        res.json({
            categoryKey: config.categoryKey,
            featuredSpecKeys: config.featuredSpecKeys,
            mode
        });
    } catch (error) {
        next(error);
    }
};

export const getSpecValues = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const categoryKeyRaw = req.params.categoryKey;
        const categoryKey = Array.isArray(categoryKeyRaw) ? categoryKeyRaw[0] : categoryKeyRaw;
        const specKeyRaw = req.params.specKey;
        const specKey = Array.isArray(specKeyRaw) ? specKeyRaw[0] : specKeyRaw;

        const category = await Category.findOne({ slug: categoryKey });
        if (!category) {
            const err: AppError = new Error('Category not found');
            err.code = 'CATEGORY_NOT_FOUND';
            err.status = 404;
            return next(err);
        }

        const normalizedKey = normalizeSpecKey(specKey);

        const pipeline = [
            { $match: { categoryIds: category._id, isActive: true } },
            SPECS_OBJECT_TO_ARRAY_PROJECT,
            { $unwind: '$specs' },
            { $match: { 'specs.k': normalizedKey } },
            { $group: { _id: '$specs.v' } },
            { $sort: { _id: 1 } }
        ];

        const results = await Product.aggregate(pipeline as any);
        const values = results.map((r: { _id: string }) => r._id).filter(Boolean);

        res.json({ categoryKey, specKey: normalizedKey, values });
    } catch (error) {
        next(error);
    }
};

export const deleteFeaturedSpecs = async (req: Request, res: Response, next: any): Promise<void> => {
    try {
        const categoryKeyRaw = req.params.categoryKey;
        const categoryKey = Array.isArray(categoryKeyRaw) ? categoryKeyRaw[0] : categoryKeyRaw;

        const result = await CategoryFeaturedSpecs.findOneAndDelete({ categoryKey });

        if (!result) {
            const err: AppError = new Error('Configuration not found');
            err.code = 'CONFIG_NOT_FOUND';
            err.status = 404;
            return next(err);
        }
        clearFeaturedSpecsCache(categoryKey);
        invalidateFacetCaches();

        res.json({ message: 'Configuration deleted, reverted to default behavior' });
    } catch (error) {
        next(error);
    }
};
