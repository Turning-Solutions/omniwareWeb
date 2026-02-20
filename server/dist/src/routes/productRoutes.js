"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const productController_1 = require("../controllers/productController");
const router = express_1.default.Router();
router.get('/', productController_1.getProducts);
router.get('/facets', productController_1.getProductFacets);
router.get('/grouped', productController_1.getProductsGrouped);
router.get('/brands', productController_1.getBrands);
router.get('/categories', productController_1.getCategories);
router.get('/id/:id', productController_1.getProductById);
router.get('/:slug', productController_1.getProductBySlug);
exports.default = router;
