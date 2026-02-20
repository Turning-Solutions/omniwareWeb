"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productUpdateSchema = exports.productSchema = void 0;
const zod_1 = require("zod");
exports.productSchema = zod_1.z.object({
    title: zod_1.z.string().min(3, "Title must be at least 3 characters"),
    slug: zod_1.z.string().optional(), // Often generated
    sku: zod_1.z.string().optional(), // Often generated
    brandId: zod_1.z.string().optional(),
    categoryIds: zod_1.z.array(zod_1.z.string()).optional(),
    price: zod_1.z.number().min(0),
    stock: zod_1.z.object({
        qty: zod_1.z.number().min(0)
    }),
    description: zod_1.z.string().optional(),
    specs: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    images: zod_1.z.array(zod_1.z.string()).optional(),
    attributes: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        value: zod_1.z.string()
    })).optional(),
    variants: zod_1.z.array(zod_1.z.object({
        sku: zod_1.z.string().optional(),
        price: zod_1.z.number(),
        stock: zod_1.z.object({ qty: zod_1.z.number() }),
        attributes: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            value: zod_1.z.string()
        }))
    })).optional(),
    isFeatured: zod_1.z.boolean().optional(),
    isActive: zod_1.z.boolean().optional()
});
exports.productUpdateSchema = exports.productSchema.partial();
