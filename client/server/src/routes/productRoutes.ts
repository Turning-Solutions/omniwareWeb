import express from 'express';
import { getPublicAttributeAliases } from '../controllers/attributeAliasController';
import { getProducts, getProductBySlug, getProductById, getBrands, getCategories, getProductsGrouped, getProductFacets } from '../controllers/productController';

const router = express.Router();

router.get('/', getProducts);
router.get('/facets', getProductFacets);
router.get('/grouped', getProductsGrouped);
router.get('/brands', getBrands);
router.get('/categories', getCategories);
router.get('/attribute-aliases/:categoryId', getPublicAttributeAliases);
router.get('/id/:id', getProductById);
router.get('/:slug', getProductBySlug);

export default router;
