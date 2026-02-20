"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const Product_1 = __importDefault(require("../models/Product"));
const Brand_1 = __importDefault(require("../models/Brand"));
const Category_1 = __importDefault(require("../models/Category"));
const audit_1 = require("../utils/audit");
const productAggregation_1 = require("../utils/productAggregation");
const router = express_1.default.Router();
// router.use(requireAuth, requireAdmin, adminRateLimit);
// GET /api/v1/admin/products
router.get('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { q, category, brand, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * limitNum;
    // Map 'q' to 'search' for the helper
    if (q)
        req.query.search = q;
    const match = yield (0, productAggregation_1.buildProductMatchStage)(req);
    const [items, total] = yield Promise.all([
        Product_1.default.find(match)
            .populate('brandId', 'name')
            .populate('categoryIds', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        Product_1.default.countDocuments(match),
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
}));
// GET /api/v1/admin/products/:id
router.get('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const product = yield Product_1.default.findById(req.params.id).lean();
    if (!product)
        return res.status(404).json({ message: 'Product not found' });
    res.json(product);
}));
// POST /api/v1/admin/products
router.post('/', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const product = yield Product_1.default.create(req.body);
        yield (0, audit_1.createAuditLog)(req, {
            action: 'CREATE_PRODUCT',
            entityType: 'Product',
            entityId: product._id.toString(),
            after: product.toObject(),
        });
        res.status(201).json(product);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
// PATCH /api/v1/admin/products/:id
router.patch('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const before = yield Product_1.default.findById(req.params.id).lean();
    if (!before)
        return res.status(404).json({ message: 'Product not found' });
    try {
        const updated = yield Product_1.default.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        }).lean();
        yield (0, audit_1.createAuditLog)(req, {
            action: 'UPDATE_PRODUCT',
            entityType: 'Product',
            entityId: req.params.id,
            before,
            after: updated,
        });
        res.json(updated);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
// DELETE /api/v1/admin/products/:id
router.delete('/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const before = yield Product_1.default.findById(req.params.id).lean();
    if (!before)
        return res.status(404).json({ message: 'Product not found' });
    yield Product_1.default.findByIdAndDelete(req.params.id);
    yield (0, audit_1.createAuditLog)(req, {
        action: 'DELETE_PRODUCT',
        entityType: 'Product',
        entityId: req.params.id,
        before,
    });
    res.status(204).send();
}));
// --- Brands CRUD ---
router.post('/brands', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, slug, logoUrl } = req.body;
        const brand = yield Brand_1.default.create({ name, slug, logoUrl, isActive: true });
        res.status(201).json(brand);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.put('/brands/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const brand = yield Brand_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!brand)
            return res.status(404).json({ message: 'Brand not found' });
        res.json(brand);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
// --- Categories CRUD ---
router.post('/categories', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, slug, parentId } = req.body;
        const category = yield Category_1.default.create({ name, slug, parentId, isActive: true });
        res.status(201).json(category);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
router.put('/categories/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const category = yield Category_1.default.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!category)
            return res.status(404).json({ message: 'Category not found' });
        res.json(category);
    }
    catch (error) {
        res.status(400).json({ message: error.message });
    }
}));
exports.default = router;
