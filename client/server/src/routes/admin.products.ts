import express, { Request, Response } from 'express';
import Product from '../models/Product';
import Brand from '../models/Brand';
import Category from '../models/Category';
import { requireAuth } from '../middleware/requireAuth';
import { requireAdmin } from '../middleware/requireAdmin';
import { adminRateLimit } from '../middleware/adminRateLimit';
import { createAuditLog } from '../utils/audit';
import { buildProductMatchStage } from '../utils/productAggregation';

const router = express.Router();

router.use(requireAuth, requireAdmin, adminRateLimit);

// GET /api/v1/admin/products
router.get('/', async (req: Request, res: Response) => {
    const { q, category, brand, page = '1', limit = '20' } = req.query;

    const pageNum = Math.max(parseInt(page as string, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit as string, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    // Map 'q' to 'search' for the helper
    if (q) req.query.search = q as string;

    const match = await buildProductMatchStage(req);

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

// GET /api/v1/admin/products/:id
router.get('/:id', async (req: Request, res: Response) => {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
});

// POST /api/v1/admin/products
router.post('/', async (req: Request, res: Response) => {
    try {
        const product = await Product.create(req.body);

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
        const updated = await Product.findByIdAndUpdate(req.params.id, req.body, {
            returnDocument: 'after',
            runValidators: true,
        }).lean();

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

// DELETE /api/v1/admin/products/:id
router.delete('/:id', async (req: Request, res: Response) => {
    const before = await Product.findById(req.params.id).lean();
    if (!before) return res.status(404).json({ message: 'Product not found' });

    await Product.findByIdAndDelete(req.params.id);

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
        const category = await Category.create({ name, slug, parentId, isActive: true });
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

router.put('/categories/:id', async (req: Request, res: Response) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        if (!category) return res.status(404).json({ message: 'Category not found' });
        res.json(category);
    } catch (error) {
        res.status(400).json({ message: (error as Error).message });
    }
});

export default router;

