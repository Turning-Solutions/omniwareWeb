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
exports.deleteFeaturedSpecs = exports.updateFeaturedSpecs = exports.getFeaturedSpecs = exports.getAvailableSpecKeys = void 0;
const zod_1 = require("zod");
const Product_1 = __importDefault(require("../models/Product"));
const CategoryFeaturedSpecs_1 = __importDefault(require("../models/CategoryFeaturedSpecs"));
const Category_1 = __importDefault(require("../models/Category"));
const normalizeSpecKey_1 = require("../utils/normalizeSpecKey");
const updateFeaturedSpecsSchema = zod_1.z.object({
    featuredSpecKeys: zod_1.z.array(zod_1.z.string()),
});
const getAvailableSpecKeys = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryKey } = req.params;
        const category = yield Category_1.default.findOne({ slug: categoryKey });
        if (!category) {
            const err = new Error('Category not found');
            err.code = 'CATEGORY_NOT_FOUND';
            err.status = 404;
            return next(err);
        }
        const pipeline = [
            { $match: { categoryIds: category._id } },
            { $project: { specs: { $objectToArray: "$specs" } } },
            { $unwind: "$specs" },
            { $group: { _id: "$specs.k" } },
            { $sort: { _id: 1 } }
        ];
        const results = yield Product_1.default.aggregate(pipeline);
        // Normalize any keys retrieved from db to match the standard
        const rawKeys = results.map(r => r._id);
        const specKeys = [...new Set(rawKeys.map(normalizeSpecKey_1.normalizeSpecKey))].filter(Boolean);
        res.json({
            categoryKey,
            availableSpecKeys: specKeys
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getAvailableSpecKeys = getAvailableSpecKeys;
const getFeaturedSpecs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryKey } = req.params;
        const config = yield CategoryFeaturedSpecs_1.default.findOne({ categoryKey });
        let mode = 'default_all';
        let featuredSpecKeys = [];
        if (config) {
            featuredSpecKeys = config.featuredSpecKeys;
            mode = featuredSpecKeys.length > 0 ? 'restricted' : 'none';
        }
        res.json({
            categoryKey,
            featuredSpecKeys,
            mode
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getFeaturedSpecs = getFeaturedSpecs;
const updateFeaturedSpecs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryKey } = req.params;
        const result = updateFeaturedSpecsSchema.safeParse(req.body);
        if (!result.success) {
            const err = new Error('Invalid input');
            err.code = 'VALIDATION_ERROR';
            err.status = 400;
            err.details = result.error.format();
            return next(err);
        }
        const category = yield Category_1.default.findOne({ slug: categoryKey });
        if (!category) {
            const err = new Error('Category not found');
            err.code = 'CATEGORY_NOT_FOUND';
            err.status = 404;
            return next(err);
        }
        const normalizedKeys = [...new Set(result.data.featuredSpecKeys.map(normalizeSpecKey_1.normalizeSpecKey))].filter(Boolean);
        const config = yield CategoryFeaturedSpecs_1.default.findOneAndUpdate({ categoryKey }, {
            categoryKey,
            featuredSpecKeys: normalizedKeys
        }, { new: true, upsert: true, setDefaultsOnInsert: true });
        let mode = 'default_all';
        if (config) {
            mode = config.featuredSpecKeys.length > 0 ? 'restricted' : 'none';
        }
        res.json({
            categoryKey: config.categoryKey,
            featuredSpecKeys: config.featuredSpecKeys,
            mode
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateFeaturedSpecs = updateFeaturedSpecs;
const deleteFeaturedSpecs = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryKey } = req.params;
        const result = yield CategoryFeaturedSpecs_1.default.findOneAndDelete({ categoryKey });
        if (!result) {
            const err = new Error('Configuration not found');
            err.code = 'CONFIG_NOT_FOUND';
            err.status = 404;
            return next(err);
        }
        res.json({ message: 'Configuration deleted, reverted to default behavior' });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteFeaturedSpecs = deleteFeaturedSpecs;
