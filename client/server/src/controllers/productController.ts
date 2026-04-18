import { Request, Response } from 'express';
import Product from '../models/Product';
import Brand from '../models/Brand';
import Category from '../models/Category';
import CategoryFeaturedSpecs from '../models/CategoryFeaturedSpecs';
import { buildProductMatchStage, SPECS_OBJECT_TO_ARRAY_PROJECT, type MatchStageCache } from '../utils/productAggregation';
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

const hasFilters = (req: Request): boolean => {
    const { search, minPrice, maxPrice, brand, category, availability, inStock, isFeatured } = req.query;
    if (search || minPrice || maxPrice || brand || category || availability || inStock || isFeatured) return true;
    const keys = Object.keys(req.query).filter((k) => k.startsWith('spec['));
    return keys.length > 0;
};

function normalizeDiscountAmount(input: unknown): number | null {
    if (input == null) return null;
    const n = typeof input === 'number' ? input : Number(input);
    if (!Number.isFinite(n)) return null;
    if (n <= 0) return null;
    // Clamp to keep data safe even if someone bypasses UI/API validation
    return Math.max(0, n);
}

function computeEffectiveDiscountAmount(product: any): number | null {
    // 1) Product-level override wins
    const productOverride = normalizeDiscountAmount(product?.discountPercent);
    if (productOverride != null) return productOverride;

    // 2) Otherwise, apply the discount from the product's *first* category.
    // We support both API response shapes:
    // - aggregate list route: populated `categories` + raw `categoryIds`
    // - product detail route: populated `categoryIds` (with discountPercent)

    // If `categoryIds[0]` is already a populated category object, read its discount directly.
    if (Array.isArray(product?.categoryIds) && product.categoryIds.length > 0) {
        const first = product.categoryIds[0] as any;
        const direct = normalizeDiscountAmount(first?.discountPercent);
        if (direct != null) return direct;
    }

    const firstCategoryId =
        Array.isArray(product?.categoryIds) && product.categoryIds.length > 0
            ? product.categoryIds[0]
            : null;

    const categoriesFromLookup = Array.isArray(product?.categories) ? product.categories : [];
    if (firstCategoryId != null && categoriesFromLookup.length > 0) {
        const match = categoriesFromLookup.find(
            (c: any) => String(c?._id ?? '') === String(firstCategoryId)
        );
        return match ? normalizeDiscountAmount(match?.discountPercent) : null;
    }

    // Fallback: use the first category document if present (aggregate route only).
    if (categoriesFromLookup.length > 0) return normalizeDiscountAmount(categoriesFromLookup[0]?.discountPercent);

    return null;
}

function withDiscountInfo(product: any): any {
    const originalPrice = typeof product?.price === 'number' ? product.price : Number(product?.price);
    if (!Number.isFinite(originalPrice)) {
        return { ...product, originalPrice: null, discountedPrice: null, effectiveDiscountPercent: null };
    }

    const effectiveDiscountAmount = computeEffectiveDiscountAmount(product);
    const discountedPrice =
        effectiveDiscountAmount != null
            ? Math.max(0, Math.round(originalPrice - effectiveDiscountAmount))
            : originalPrice;

    return {
        ...product,
        originalPrice,
        discountedPrice,
        effectiveDiscountPercent: effectiveDiscountAmount,
    };
}

export const getProducts = async (req: Request, res: Response) => {
    try {
        // Cache product listing responses at the CDN edge in production.
        // This helps absorb repeated traffic while keeping data reasonably fresh.
        res.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');

        const { search, minPrice, maxPrice, brand, category, sort, page = 1, limit = 20, facets = 'true', ...dynamicFilters } = req.query;
        const includeFacets = String(facets).toLowerCase() !== 'false';
        const limitNum = Math.min(Number(limit) || 20, 100);
        const pageNum = Math.max(Number(page) || 1, 1);
        const skip = (pageNum - 1) * limitNum;
        const sortStage = buildProductSortStage(sort);

        // Fast path for initial list rendering: skip facet aggregation entirely.
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

            const productsWithDiscount = products.map(withDiscountInfo);

            return res.json({
                products: productsWithDiscount,
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

        // Lightweight path: no filters + small limit (e.g. homepage featured only) — skip facets.
        // Shop page uses limit 20 and needs facets for the filter sidebar, so only use when limit <= 8.
        if (!hasFilters(req) && limitNum <= 8) {
            const [products, total] = await Promise.all([
                Product.aggregate([
                    { $match: { isActive: true } },
                    { $sort: sortStage },
                    { $skip: skip },
                    { $limit: limitNum },
                    { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brand' } },
                    { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                    { $lookup: { from: 'categories', localField: 'categoryIds', foreignField: '_id', as: 'categories' } },
                ]),
                Product.countDocuments({ isActive: true }),
            ]);
            res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

            const productsWithDiscount = products.map(withDiscountInfo);

            return res.json({
                products: productsWithDiscount,
                pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
                categoryKey: null,
                featuredMode: 'default_all',
                featuredSpecKeys: [],
                facets: { price: { min: 0, max: 0 }, categories: [], brands: [], availability: [], specs: {} },
            });
        }

        const lookupCache: MatchStageCache = {};
        // 1. Full Match (For Products & Counts)
        const matchStage = await buildProductMatchStage(req, [], lookupCache);
        // 2. Facet Matches (Exclude specific filters) — reuse cached Brand/Category lookups
        const categoryMatchStage = await buildProductMatchStage(req, ['category'], lookupCache);
        const brandMatchStage = await buildProductMatchStage(req, ['brand'], lookupCache);
        const priceMatchStage = await buildProductMatchStage(req, ['price'], lookupCache);
        const specsMatchStage = await buildProductMatchStage(req, ['specs'], lookupCache);

        // --- Aggregation Pipeline ---
        // Note: We cannot start with a common $match because facets need DIFFERENT matches.
        // So strict match happens INSIDE the 'products' and 'totalCount' pipelines.
        // Relaxed matches happen INSIDE 'brands' and 'price' pipelines.
        const pipeline = [
            {
                $facet: {
                    // 1. Paginated Products
                    products: [
                        { $match: matchStage },
                        { $sort: sortStage },
                        { $skip: skip },
                        { $limit: limitNum },
                        { $lookup: { from: 'brands', localField: 'brandId', foreignField: '_id', as: 'brand' } },
                        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
                        { $lookup: { from: 'categories', localField: 'categoryIds', foreignField: '_id', as: 'categories' } }
                    ],
                    // 2. Total Count (for pagination)
                    totalCount: [
                        { $match: matchStage },
                        { $count: 'count' }
                    ],

                    // 3. Facets 

                    // Price Range (Using priceMatchStage - shows range for all products in this category/search, ignoring current price filter)
                    price: [
                        { $match: priceMatchStage },
                        { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }
                    ],
                    // Categories (Using categoryMatchStage)
                    categories: [
                        { $match: categoryMatchStage },
                        { $unwind: "$categoryIds" },
                        { $group: { _id: "$categoryIds", count: { $sum: 1 } } },
                        { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
                        { $unwind: "$category" },
                        { $project: { value: "$category.slug", label: "$category.name", count: 1 } },
                        { $sort: { label: 1 } }
                    ],
                    // Brands (Using brandMatchStage - show all brands in this category/search, even if one is selected)
                    brands: [
                        { $match: brandMatchStage },
                        { $group: { _id: "$brandId", count: { $sum: 1 } } },
                        { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
                        { $unwind: "$brand" },
                        { $project: { value: "$brand.slug", label: "$brand.name", count: 1 } },
                        { $sort: { label: 1 } } // Sort brands alphabetically
                    ],
                    // Availability (Typically we want to see counts for selected filters, OR relaxed? 
                    // Usually availability is singular. Let's use full match or specific? 
                    // Let's use brandMatchStage as a "General Relaxed" or just Full Match. 
                    // If I select "In Stock", "Out of Stock" should probably still be visible with count strict? 
                    // Let's use Full Match for now for availability to show what's strictly available in current view)
                    availability: [
                        { $match: matchStage },
                        { $group: { _id: "$availability", count: { $sum: 1 } } },
                        { $project: { value: "$_id", count: 1, _id: 0 } }
                    ],
                    // Specs (Dynamic): keep all values visible for multi-select
                    // by excluding current spec selections from the facet match.
                    specs: [
                        { $match: specsMatchStage },
                        SPECS_OBJECT_TO_ARRAY_PROJECT,
                        { $unwind: "$specs" },
                        // Group by Key+Value to get counts
                        {
                            $group: {
                                _id: { key: "$specs.k", value: "$specs.v" },
                                count: { $sum: 1 }
                            }
                        },
                        // Group by Key to form the list
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
        if (!data) {
            return res.json({
                products: [],
                pagination: { total: 0, page: pageNum, limit: limitNum, pages: 0 },
                categoryKey: category || null,
                featuredMode: 'default_all',
                featuredSpecKeys: [],
                facets: { price: { min: 0, max: 0 }, categories: [], brands: [], availability: [], specs: {} },
            });
        }
        const total = data.totalCount?.[0]?.count ?? 0;

        // Only show spec filters that are in the category's featured list; never show all attributes
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

        let finalFacets = {
            price: data.price?.[0] || { min: 0, max: 0 },
            categories: data.categories || [],
            brands: data.brands || [],
            availability: data.availability || [],
            specs: specsFacet
        };


        res.json({
            products: (data.products || []).map(withDiscountInfo),
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            },
            categoryKey: categoryKeyForSpecs ?? (typeof category === 'string' ? category : null),
            featuredMode,
            featuredSpecKeys,
            facets: finalFacets
        });

    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

export const getProductFacets = async (req: Request, res: Response) => {
    try {
        // Almost identical logic to getProducts, but we can omit the 'products' fetch if performance is critical,
        // or just return the facets.
        // For simplicity/DRY, one could extract the 'buildMatchStage' logic.
        // For now, I will duplicate the precise match logic to ensure it behaves exactly as the listing.

        const { search, minPrice, maxPrice, brand, category, ...dynamicFilters } = req.query;

        const lookupCache: MatchStageCache = {};
        // 1. Full Match
        const matchStage = await buildProductMatchStage(req, [], lookupCache);
        // 2. Facet Matches (Exclude specific filters)
        const categoryMatchStage = await buildProductMatchStage(req, ['category'], lookupCache);
        const brandMatchStage = await buildProductMatchStage(req, ['brand'], lookupCache);
        const priceMatchStage = await buildProductMatchStage(req, ['price'], lookupCache);
        const specsMatchStage = await buildProductMatchStage(req, ['specs'], lookupCache);

        const pipeline = [
            {
                $facet: {
                    price: [
                        { $match: priceMatchStage },
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
                        { $match: brandMatchStage },
                        { $group: { _id: "$brandId", count: { $sum: 1 } } },
                        { $lookup: { from: 'brands', localField: '_id', foreignField: '_id', as: 'brand' } },
                        { $unwind: "$brand" },
                        { $project: { value: "$brand.slug", label: "$brand.name", count: 1 } }
                    ],
                    availability: [
                        { $match: matchStage },
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

function isValidObjectIdString(s: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(s);
}

export const getProductBySlug = async (req: Request, res: Response) => {
    try {
        const slugOrId = Array.isArray(req.params.slug) ? req.params.slug[0] ?? '' : (req.params.slug ?? '');
        const byId = isValidObjectIdString(slugOrId);
        const product = byId
            ? await Product.findOne({ _id: slugOrId, isActive: true })
                .populate('brandId', 'name slug logoUrl')
                .populate('categoryIds', 'name slug discountPercent')
            : await Product.findOne({ slug: slugOrId, isActive: true })
                .populate('brandId', 'name slug logoUrl')
                .populate('categoryIds', 'name slug discountPercent');

        if (product) {
            const normalized = normalizeProductAttributeGroups(product);
            res.json(withDiscountInfo(normalized));
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: (error as Error).message });
    }
};

import { productSchema, productUpdateSchema } from '../schemas/productSchema';
import mongoose from 'mongoose';

// ... (getProducts)

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
    // `specs` is stored as `Map` in Mongo. Ensure we serialize it as a plain object
    // so the admin UI can read values via `Object.entries`.
    if (pojo.specs && typeof pojo.specs === 'object') {
        if (pojo.specs instanceof Map) {
            pojo.specs = Object.fromEntries(pojo.specs.entries());
        } else if (typeof (pojo.specs as any).toObject === 'function') {
            pojo.specs = (pojo.specs as any).toObject();
        } else if (Array.isArray(pojo.specs)) {
            pojo.specs = {};
        }
    }
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
            .populate('categoryIds', 'name slug discountPercent');

        if (product) {
            const normalized = normalizeProductAttributeGroups(product);
            res.json(withDiscountInfo(normalized));
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
