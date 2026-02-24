import { z } from 'zod';

export const productSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    slug: z.string().optional(), // Often generated
    sku: z.string().optional(), // Often generated
    brandId: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    price: z.number().min(0),
    stock: z.object({
        qty: z.number().min(0)
    }),
    description: z.string().optional(),
    specs: z.record(z.string(), z.string()).optional(),
    images: z.array(z.string()).optional(),
    attributeGroups: z.array(z.object({
        category: z.string(),
        attributes: z.array(z.object({
            name: z.string(),
            value: z.string()
        }))
    })).optional(),
    attributes: z.array(z.object({
        name: z.string(),
        value: z.string()
    })).optional(),
    variants: z.array(z.object({
        sku: z.string().optional(),
        price: z.number(),
        stock: z.object({ qty: z.number() }),
        attributes: z.array(z.object({
            name: z.string(),
            value: z.string()
        }))
    })).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional()
});

export const productUpdateSchema = productSchema.partial();
