import { Request, Response } from 'express';
import Product from '../models/Product';
import Brand from '../models/Brand';
import Category from '../models/Category';
import CategoryFeaturedSpecs from '../models/CategoryFeaturedSpecs';
import {
    buildProductMatchStage,
    SPECS_OBJECT_TO_ARRAY_PROJECT,
    type MatchStageCache,
} from '../utils/productAggregation';
import { normalizeSpecKey } from '../utils/normalizeSpecKey';

/** Maps shop URL values like price-asc to Mongo sort (also accepts price_asc). */
function buildProductSortStage(sort: unknown): Record<string, 1 | -1> {
    const key = String(sort ?? '')
        .trim()
        .toLowerCase()
        .replace(/-/g, '_');
    if (key === 'price_asc') return { price: 1 };
    if (key === 'price_desc') return { price: -1 };
    if (key === 'newest') return { createdAt: -1 };
    if (key === 'name_asc') return { title: 1 };
    return { createdAt: -1 };
}

/** Matches admin `categoryKey` on CategoryFeaturedSpecs (typically lowercase slugs). */
function normalizeCategoryKeyForFeaturedSpecs(category: unknown): string | null {
    if (category == null || typeof category !== 'string') return null;
    const first = category.split(',')[0]?.trim();
    return first ? first.toLowerCase() : null;
}

function normalizeDiscountPercent(input: unknown): number | null {
    if (input == null) return null;
    const n = typeof input === 'number' ? input : Number(input);
    if (!Number.isFinite(n)) return null;
    if (n <= 0) return null;
    return Math.max(0, Math.min(100, n));
}

function computeEffectiveDiscountPercent(product: any): number | null {
    const productOverride = normalizeDiscountPercent(product?.discountPercent);
    if (productOverride != null) return productOverride;

    if (Array.isArray(product?.categoryIds) && product.categoryIds.length > 0) {
        const first = product.categoryIds[0] as any;
        const direct = normalizeDiscountPercent(first?.discountPercent);
        if (direct != null) return direct;
    }

    const firstCategoryId =
        Array.isArray(product?.categoryIds) && product.categoryIds.length > 0 ? product.categoryIds[0] : null;

    const categoriesFromLookup = Array.isArray(product?.categories) ? product.categories : [];
    if (firstCategoryId != null && categoriesFromLookup.length > 0) {
        const match = categoriesFromLookup.find((c: any) => String(c?._id ?? '') === String(firstCategoryId));
        return match ? normalizeDiscountPercent(match?.discountPercent) : null;
    }

    if (categoriesFromLookup.length > 0) return normalizeDiscountPercent(categoriesFromLookup[0]?.discountPercent);

    return null;
}

function withDiscountInfo(product: any): any {
    const originalPrice = typeof product?.price === 'number' ? product.price : Number(product?.price);
    if (!Number.isFinite(originalPrice)) {
        return { ...product, originalPrice: null, discountedPrice: null, effectiveDiscountPercent: null };
    }

    const effectiveDiscountPercent = computeEffectiveDiscountPercent(product);
    const discountedPrice =
        effectiveDiscountPercent != null
            ? Math.round(originalPrice * (1 - effectiveDiscountPercent / 100))
            : originalPrice;

    return {
        ...product,
        originalPrice,
        discountedPrice,
        effectiveDiscountPercent,
    };
}

export const getProducts = async (req: Request, res: Response) => {
    try {
        res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');

        const { search, minPrice, maxPrice, brand, category, sort, page = 1, limit = 20, facets = 'true' } = req.query;
        const includeFacets = String(facets).toLowerCase() !== 'false';
        const limitNum = Math.min(Number(limit) || 20, 100);
        const pageNum = Math.max(Number(page) || 1, 1);
        const skip = (pageNum - 1) * limitNum;
        const sortStage = buildProductSortStage(sort);

        if (!includeFacets) {
            const lookupCache: MatchStageCache = {};
            const matchStage = await buildProductMatchStage(req, [], lookupCache);
            const [products, total] = await Promise.all([
                Product.aggregate([
                    { $match: matchStage },
                    { $sort: sortStage },
                    { $skip: skip },
                    { $limit: limitNum },
                    { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brand' } },
                    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                    { $lookup: { from: 'categories', localField: 'categoryIds', foreignField: '_id', as: 'categories' } },
                ]),
                Product.countDocuments(matchStage),
            ]);

            return res.json({
                products: products.map(withDiscountInfo),
                pagination: {
                    total,
                    page: pageNum,
                    limit: limitNum,
                    pages: Math.ceil(total / limitNum),
                },
                categoryKey: category || null,
                featuredMode: 'none',
                featuredSpecKeys: [],
                facets: { price: { min: 0, max: 0 }, categories: [], brands: [], availability: [], specs: {} },
            });
        }

        const lookupCache: MatchStageCache = {};
        const matchStage = await buildProductMatchStage(req, [], lookupCache);
        const categoryMatchStage = await buildProductMatchStage(req, ['category'], lookupCache);
        const brandMatchStage = await buildProductMatchStage(req, ['brand'], lookupCache);
        const priceMatchStage = await buildProductMatchStage(req, ['price'], lookupCache);
        const specsMatchStage = await buildProductMatchStage(req, ['specs'], lookupCache);

        const pipeline = [
            {
                $facet: {
                    products: [
                        { $match: matchStage },
                        { $sort: sortStage },
                        { $skip: skip },
                        { $limit: limitNum },
                        { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brand' } },
                        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: 'categories', localField: 'categoryIds', foreignField: '_id', as: 'categories' } },
                    ],
                    totalCount: [{ $match: matchStage }, { $count: 'count' }],
                    price: [
                        { $match: priceMatchStage },
                        { $group: { _id: null, min: { $min: '$price' }, max: { $max: '$price' } } },
                    ],
                    categories: [
                        { $match: categoryMatchStage },
                        { $unwind: '$categoryIds' },
                        { $group: { _id: '$categoryIds', count: { $sum: 1 } } },
                        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
                        { $unwind: '$category' },
                        { $project: { value: '$category.slug', label: '$category.name', count: 1 } },
                        { $sort: { label: 1 } },
                    ],
                    brands: [
                        { $match: brandMatchStage },
                        { $group: { _id: '$brandId', count: { $sum: 1 } } },
                        { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
                        { $unwind: '$brand' },
                        { $project: { value: '$brand.slug', label: '$brand.name', count: 1 } },
                        { $sort: { label: 1 } },
                    ],
                    availability: [
                        { $match: matchStage },
                        { $group: { _id: '$availability', count: { $sum: 1 } } },
                        { $project: { value: '$_id', count: 1, _id: 0 } },
                    ],
                    specs: [
                        { $match: specsMatchStage },
                        SPECS_OBJECT_TO_ARRAY_PROJECT,
                        { $unwind: '$specs' },
                        {
                            $group: {
                                _id: { key: '$specs.k', value: '$specs.v' },
                                count: { $sum: 1 },
                            },
                        },
                        {
                            $group: {
                                _id: '$_id.key',
                                values: { $push: { value: '$_id.value', count: '$count' } },
                            },
                        },
                    ],
                },
            },
        ];

        const results = await Product.aggregate(pipeline as any);
        const data = results[0];
        if (!data) {
            return res.json({
                products: [],
                pagination: { total: 0, page: pageNum, limit: limitNum, pages: 0 },
                categoryKey: category || null,
                featuredMode: 'none',
                featuredSpecKeys: [],
                facets: { price: { min: 0, max: 0 }, categories: [], brands: [], availability: [], specs: {} },
            });
        }
        const total = data.totalCount?.[0]?.count ?? 0;

        let featuredMode: 'restricted' | 'none' = 'none';
        let featuredSpecKeys: string[] = [];

        const categoryKeyForSpecs = normalizeCategoryKeyForFeaturedSpecs(category);
        if (categoryKeyForSpecs) {
            const featuredConfig = await CategoryFeaturedSpecs.findOne({ categoryKey: categoryKeyForSpecs });
            if (featuredConfig && Array.isArray(featuredConfig.featuredSpecKeys) && featuredConfig.featuredSpecKeys.length > 0) {
                featuredSpecKeys = featuredConfig.featuredSpecKeys;
                featuredMode = 'restricted';
            }
        }

        const specsFacet: Record<string, any[]> = {};
        if (featuredMode === 'restricted') {
            (data.specs || []).forEach((item: any) => {
                const normalizedKey = normalizeSpecKey(item._id);
                if (featuredSpecKeys.includes(normalizedKey)) {
                    specsFacet[normalizedKey] = item.values;
                }
            });
        }

        const finalFacets = {
            price: data.price?.[0] || { min: 0, max: 0 },
            categories: data.categories || [],
            brands: data.brands || [],
            availability: data.availability || [],
            specs: specsFacet,
        };

        res.json({
            products: (data.products || []).map(withDiscountInfo),
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum),
            },
            categoryKey: categoryKeyForSpecs ?? (typeof category === 'string' ? category : null),
            featuredMode,
            featuredSpecKeys,
            facets: finalFacets,
        });
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getProductFacets = async (req: Request, res: Response) => {
    try {
        const { search, minPrice, maxPrice, brand, category, ...dynamicFilters } = req.query;

        const lookupCache: MatchStageCache = {};
        const matchStage = await buildProductMatchStage(req, [], lookupCache);
        const categoryMatchStage = await buildProductMatchStage(req, ['category'], lookupCache);
        const specsMatchStage = await buildProductMatchStage(req, ['specs'], lookupCache);

        const pipeline = [
            { $match: matchStage },
            {
                $facet: {
                    price: [
                        { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }
                    ],
                    categories: [
                        { $match: categoryMatchStage },
                        { $unwind: "$categoryIds" },
                        { $group: { _id: "$categoryIds", count: { $sum: 1 } } },
                        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
                        { $unwind: "$category" },
                        { $project: { value: "$category.slug", label: "$category.name", count: 1 } },
                        { $sort: { label: 1 } }
                    ],
                    brands: [
                        { $group: { _id: "$brandId", count: { $sum: 1 } } },
                        { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
                        { $unwind: "$brand" },
                        { $project: { value: "$brand.slug", label: "$brand.name", count: 1 } }
                    ],
                    availability: [
                        { $group: { _id: "$availability", count: { $sum: 1 } } },
                        { $project: { value: "$_id", count: 1, _id: 0 } }
                    ],
                    specs: [
                        { $match: specsMatchStage },
                        SPECS_OBJECT_TO_ARRAY_PROJECT,
                        { $unwind: "$specs" },
                        {
                            $group: {
                                _id: { key: "$specs.k", value: "$specs.v" },
                                count: { $sum: 1 }
                            }
                        },
                        {
                            $group: {
                                _id: "$_id.key",
                                values: { $push: { value: "$_id.value", count: "$count" } }
                            }
                        }
                    ]
                }
            }
        ];

        const results = await Product.aggregate(pipeline as any);
        const data = results[0];

        let featuredMode: 'restricted' | 'none' = 'none';
        let featuredSpecKeys: string[] = [];

        const categoryKeyForSpecsFacets = normalizeCategoryKeyForFeaturedSpecs(category);
        if (categoryKeyForSpecsFacets) {
            const featuredConfig = await CategoryFeaturedSpecs.findOne({ categoryKey: categoryKeyForSpecsFacets });
            if (featuredConfig && Array.isArray(featuredConfig.featuredSpecKeys) && featuredConfig.featuredSpecKeys.length > 0) {
                featuredSpecKeys = featuredConfig.featuredSpecKeys;
                featuredMode = 'restricted';
            }
        }

        const specsFacet: Record<string, any[]> = {};
        if (featuredMode === 'restricted' && data.specs) {
            data.specs.forEach((item: any) => {
                const normalizedKey = normalizeSpecKey(item._id);
                if (featuredSpecKeys.includes(normalizedKey)) {
                    specsFacet[normalizedKey] = item.values;
                }
            });
        }

        let finalFacets = {
            price: data.price?.[0] || { min: 0, max: 0 },
            categories: data.categories || [],
            brands: data.brands || [],
            availability: data.availability || [],
            specs: specsFacet
        };

        res.json({
            categoryKey: categoryKeyForSpecsFacets ?? (typeof category === 'string' ? category : null),
            featuredMode,
            featuredSpecKeys,
            facets: finalFacets
        });

    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getProductBySlug = async (req: Request, res: Response) => {
    try {
        const product = await Product.findOne({ slug: req.params.slug, isActive: true })
            .populate('brandId', 'name slug logoUrl')
            .populate('categoryIds', 'name slug');

        if (product) {
            res.json(normalizeProductAttributeGroups(product));
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

import { productSchema, productUpdateSchema } from '../schemas/productSchema';
import mongoose from 'mongoose';

function normalizeProductSpecs(specs: Record<string, string> | undefined): Record<string, string> | undefined {
    if (!specs || typeof specs !== 'object') return specs;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(specs)) {
        if (k != null && v != null) out[normalizeSpecKey(k)] = String(v);
    }
    return Object.keys(out).length ? out : undefined;
}

/** Ensure attributeGroups is set for API response; use legacy attributes as "General" when needed */
function normalizeProductAttributeGroups(doc: any): any {
    const pojo = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (!pojo) return pojo;
    if (pojo.attributeGroups && Array.isArray(pojo.attributeGroups) && pojo.attributeGroups.length > 0) {
        return pojo;
    }
    if (pojo.attributes && Array.isArray(pojo.attributes) && pojo.attributes.length > 0) {
        pojo.attributeGroups = [{ category: 'General', attributes: pojo.attributes }];
    } else {
        pojo.attributeGroups = [];
    }
    return pojo;
}

// ... (getProducts)

export const createProduct = async (req: Request, res: Response) => {
    try {
        const raw = req.body;
        if (raw.attributeGroups == null && raw.attributes != null && Array.isArray(raw.attributes)) {
            raw.attributeGroups = [{ category: 'General', attributes: raw.attributes }];
        }
        const validatedData = productSchema.parse(raw);
        if (validatedData.specs) validatedData.specs = normalizeProductSpecs(validatedData.specs);
        const product = new Product(validatedData);
        const createdProduct = await product.save();
        res.status(201).json(normalizeProductAttributeGroups(createdProduct));
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            res.status(400).json({ message: error.message });
        } else if ((error as any).name === 'ZodError') {
            res.status(400).json({ message: (error as any).issues });
        } else {
            res.status(500).json({ message: (error as Error).message });
        }
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const raw = req.body;
        if (raw.attributeGroups == null && raw.attributes != null && Array.isArray(raw.attributes)) {
            raw.attributeGroups = [{ category: 'General', attributes: raw.attributes }];
        }
        const validatedData = productUpdateSchema.parse(raw);
        if (validatedData.specs) validatedData.specs = normalizeProductSpecs(validatedData.specs);
        const product = await Product.findById(req.params.id);
        if (product) {
            Object.assign(product, validatedData);
            const updatedProduct = await product.save();
            res.json(normalizeProductAttributeGroups(updatedProduct));
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        if ((error as any).name === 'ZodError') {
            res.status(400).json({ message: (error as any).issues });
        } else {
            res.status(500).json({ message: (error as Error).message });
        }
    }
};

export const getBrands = async (req: Request, res: Response) => {
    try {
        const brands = await Brand.find({ isActive: true });
        res.json(brands);
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getCategories = async (req: Request, res: Response) => {
    try {
        const categories = await Category.find({ isActive: true });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getProductById = async (req: Request, res: Response) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('brandId', 'name slug logoUrl')
            .populate('categoryIds', 'name slug');

        if (product) {
            res.json(normalizeProductAttributeGroups(product));
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getProductsGrouped = async (req: Request, res: Response) => {
    try {
        const pipeline = [
            { $match: { isActive: true } },
            // Populate Brand (needed for ProductCard)
            {
                $lookup: {
                    from: 'brands',
                    localField: 'brandId',
                    foreignField: '_id',
                    as: 'brand'
                }
            },
            { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
            // Unwind categories to grouping by them
            { $unwind: '$categoryIds' },
            { $sort: { createdAt: -1 } },
            // Group by Category
            {
                $group: {
                    _id: '$categoryIds',
                    products: { $push: '$$ROOT' }
                }
            },
            // Limit to top 4 per category
            {
                $project: {
                    products: { $slice: ['$products', 4] }
                }
            },
            // Lookup Category Details
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            { $match: { 'category.isActive': true } },
            // Sort categories by name (optional)
            { $sort: { 'category.name': 1 } }
        ];

        const groupedProducts = await Product.aggregate(pipeline as any[]);

        res.json(groupedProducts);

    } catch (error) {
        console.error("getProductsGrouped Error:", error);
        res.status(500).json({ message: (error as Error).message });
    }
};
