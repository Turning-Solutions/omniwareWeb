import { Request, Response } from 'express';
import Product from '../models/Product';
import Brand from '../models/Brand';
import Category from '../models/Category';
import CategoryFeaturedSpecs from '../models/CategoryFeaturedSpecs';
import { buildProductMatchStage } from '../utils/productAggregation';
import { normalizeSpecKey } from '../utils/normalizeSpecKey';

export const getProducts = async (req: Request, res: Response) => {
    try {
        const { search, minPrice, maxPrice, brand, category, sort, page = 1, limit = 20, ...dynamicFilters } = req.query;

        // 1. Full Match (For Products & Counts)
        const matchStage = await buildProductMatchStage(req);

        // 2. Facet Matches (Exclude specific filters to keep options visible)
        // For Brands: Exclude 'brand' filter so we see other brands
        // For Categories: Exclude 'category' filter
        const categoryMatchStage = await buildProductMatchStage(req, ['category']);
        // For Brands: Exclude 'brand' filter so we see other brands
        const brandMatchStage = await buildProductMatchStage(req, ['brand']);
        // For Price: Exclude 'price' filter so we see full range
        const priceMatchStage = await buildProductMatchStage(req, ['price']);

        // --- Build Sort Stage ---
        let sortStage: any = { createdAt: -1 };
        if (sort === 'price_asc') sortStage = { price: 1 };
        else if (sort === 'price_desc') sortStage = { price: -1 };
        else if (sort === 'newest') sortStage = { createdAt: -1 };

        const skip = (Number(page) - 1) * Number(limit);

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
                        { $limit: Number(limit) },
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
                    // Specs (Dynamic)
                    // Specs are tricky. If I select "16GB", I probably want to see "32GB" option for the same set of products.
                    // But if I select "Asus", I want specs for "Asus".
                    // So Specs should probably follow matchStage (strict) or maybe exclude 'specs'?
                    // For now, let's keep it strict (matchStage) to avoid massive aggregation complexity 
                    // unless specifically requested.
                    specs: [
                        { $match: matchStage },
                        // Convert specs Map/Object to Array of k/v pairs
                        { $project: { specs: { $objectToArray: "$specs" } } },
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
                pagination: { total: 0, page: Number(page), limit: Number(limit), pages: 0 },
                categoryKey: category || null,
                featuredMode: 'default_all',
                featuredSpecKeys: [],
                facets: { price: { min: 0, max: 0 }, categories: [], brands: [], availability: [], specs: {} },
            });
        }
        const total = data.totalCount?.[0]?.count ?? 0;

        let featuredMode = 'default_all';
        let featuredSpecKeys: string[] = [];

        if (category) {
            const featuredConfig = await CategoryFeaturedSpecs.findOne({ categoryKey: category });
            if (featuredConfig) {
                featuredSpecKeys = featuredConfig.featuredSpecKeys || [];
                featuredMode = featuredSpecKeys.length > 0 ? 'restricted' : 'none';
            }
        }

        // Apply Gating (guard against missing facet data)
        const specsFacet: Record<string, any[]> = {};
        (data.specs || []).forEach((item: any) => {
            const normalizedKey = normalizeSpecKey(item._id);
            if (featuredMode === 'default_all') {
                specsFacet[normalizedKey] = item.values;
            } else if (featuredMode === 'restricted' && featuredSpecKeys.includes(normalizedKey)) {
                specsFacet[normalizedKey] = item.values;
            }
        });

        // Filter other facets if config exists
        let finalFacets = {
            price: data.price?.[0] || { min: 0, max: 0 },
            categories: data.categories || [],
            brands: data.brands || [],
            availability: data.availability || [],
            specs: featuredMode === 'none' ? {} : specsFacet
        };


        res.json({
            products: data.products || [],
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            },
            categoryKey: category || null,
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

        // 1. Full Match
        const matchStage = await buildProductMatchStage(req);

        // For Categories: Exclude 'category' filter
        const categoryMatchStage = await buildProductMatchStage(req, ['category']);

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
                        { $project: { specs: { $objectToArray: "$specs" } } },
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

        let featuredMode = 'default_all';
        let featuredSpecKeys: string[] = [];

        if (category) {
            const featuredConfig = await CategoryFeaturedSpecs.findOne({ categoryKey: category });
            if (featuredConfig) {
                featuredSpecKeys = featuredConfig.featuredSpecKeys || [];
                featuredMode = featuredSpecKeys.length > 0 ? 'restricted' : 'none';
            }
        }

        const specsFacet: Record<string, any[]> = {};
        data.specs.forEach((item: any) => {
            const normalizedKey = normalizeSpecKey(item._id);
            if (featuredMode === 'default_all') {
                specsFacet[normalizedKey] = item.values;
            } else if (featuredMode === 'restricted' && featuredSpecKeys.includes(normalizedKey)) {
                specsFacet[normalizedKey] = item.values;
            }
        });

        // Filter other facets if config exists
        let finalFacets = {
            price: data.price[0] || { min: 0, max: 0 },
            categories: data.categories,
            brands: data.brands,
            availability: data.availability,
            specs: featuredMode === 'none' ? {} : specsFacet
        };


        res.json({
            categoryKey: category || null,
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
            res.json(product);
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

export const createProduct = async (req: Request, res: Response) => {
    try {
        const validatedData = productSchema.parse(req.body);
        const product = new Product(validatedData);
        const createdProduct = await product.save();
        res.status(201).json(createdProduct);
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
        const validatedData = productUpdateSchema.parse(req.body);
        const product = await Product.findById(req.params.id);
        if (product) {
            Object.assign(product, validatedData);
            const updatedProduct = await product.save();
            res.json(updatedProduct);
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
            res.json(product);
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
