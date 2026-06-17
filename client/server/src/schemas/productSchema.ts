import { z } from 'zod';

export const productSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    slug: z.string().optional(), // Often generated
    sku: z.string().optional(), // Often generated
    brandId: z.string().optional(),
    categoryIds: z.array(z.string()).optional(),
    price: z.number().min(0),
    dealerPrice: z.number().min(0).optional(),
    /**
     * Optional product-level discount override amount.
     * If null/empty, category discount may apply.
     */
    discountPercent: z.number().min(0).nullable().optional(),
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
    colorVariants: z.array(z.object({
        name: z.string().min(1),
        hex: z.string().optional(),
        image: z.string().optional(),
        sku: z.string().optional(),
        price: z.number().optional(),
        stock: z.object({ qty: z.number().min(0) }).optional(),
    })).optional(),
    warranty: z.string().optional(),
    availability: z.enum(['in_stock', 'out_of_stock', 'pre_order', 'coming_soon']).optional(),
    seo: z.object({
        title: z.string().max(70).optional(),
        description: z.string().max(160).optional(),
        keywords: z.array(z.string()).optional(),
        image: z.string().optional(),
        imageAlt: z.string().max(180).optional(),
        noIndex: z.boolean().optional(),
    }).optional(),
    isFeatured: z.boolean().optional(),
    isActive: z.boolean().optional()
});

export const productUpdateSchema = productSchema.partial();
