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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProductMatchStage = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Brand_1 = __importDefault(require("../models/Brand"));
const Category_1 = __importDefault(require("../models/Category"));
const buildProductMatchStage = (req_1, ...args_1) => __awaiter(void 0, [req_1, ...args_1], void 0, function* (req, exclude = []) {
    // console.log('DEBUG QUERY:', JSON.stringify(req.query, null, 2));
    const _a = req.query, { search, minPrice, maxPrice, brand, category, availability, inStock } = _a, dynamicFilters = __rest(_a, ["search", "minPrice", "maxPrice", "brand", "category", "availability", "inStock"]);
    const matchStage = { isActive: true };
    if (search && !exclude.includes('search')) {
        matchStage.title = { $regex: search, $options: 'i' };
    }
    if ((minPrice || maxPrice) && !exclude.includes('price')) {
        matchStage.price = {};
        if (minPrice)
            matchStage.price.$gte = Number(minPrice);
        if (maxPrice)
            matchStage.price.$lte = Number(maxPrice);
    }
    if (inStock === 'true' && !exclude.includes('inStock')) {
        matchStage['stock.qty'] = { $gt: 0 };
    }
    if (availability && !exclude.includes('availability')) {
        const availabilities = availability.split(',');
        matchStage.availability = { $in: availabilities };
    }
    if (brand && !exclude.includes('brand')) {
        const brands = brand.split(',');
        const brandDocs = yield Brand_1.default.find({
            $or: [
                { slug: { $in: brands } },
                { _id: { $in: brands.filter(b => mongoose_1.default.Types.ObjectId.isValid(b)) } }
            ]
        });
        if (brandDocs.length > 0) {
            matchStage.brandId = { $in: brandDocs.map(b => b._id) };
        }
    }
    if (category && !exclude.includes('category')) {
        const cats = category.split(',');
        const catDocs = yield Category_1.default.find({
            $or: [
                { slug: { $in: cats } },
                { _id: { $in: cats.filter(c => mongoose_1.default.Types.ObjectId.isValid(c)) } }
            ]
        });
        if (catDocs.length > 0) {
            matchStage.categoryIds = { $in: catDocs.map(c => c._id) };
        }
    }
    // Handle Dynamic Spec Filters
    // Support two formats:
    // 1. Nested object: ?spec[vram]=12GB&spec[chipset]=RTX 4070
    // 2. Direct keys (optional, but nested is safer for namespace)
    let specsFilter = req.query.spec || {};
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
            if (!value)
                return;
            const values = Array.isArray(value) ? value : value.split(',');
            matchStage[`specs.${key}`] = { $in: values };
        });
    }
    return matchStage;
});
exports.buildProductMatchStage = buildProductMatchStage;
