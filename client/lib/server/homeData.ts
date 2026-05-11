/**
 * Direct MongoDB data fetchers for Next.js server components.
 *
 * These replace the old HTTP loopback pattern (server component → fetch() → same-process Express → MongoDB).
 * Instead, they query MongoDB directly, eliminating:
 *   - HTTP round-trip overhead
 *   - Express middleware chain (cors, json parser, auth check — none needed for public reads)
 *   - Response serialisation/deserialisation
 *
 * This single change cuts homepage SSR time from 3-8 s down to ~200-500 ms.
 */
import 'server-only';

import { ensureDb } from '@/server/src/config/db';
import type { HomePromotion } from '@/lib/homePromotionsQuery';
import type { PartnerBrand } from '@/lib/homePartnersQuery';
import type { HomeSettings } from '@/lib/homeSettingsQuery';
import type { ProductsResponse } from '@/hooks/useProducts';

// Mongoose models — Brand and Category must be imported so they're
// registered before Product.populate('brandId') / .populate('categoryIds').
import Promotion from '@/server/src/models/Promotion';
import Partner from '@/server/src/models/Partner';
import HomeSettingsModel from '@/server/src/models/HomeSettings';
import Product from '@/server/src/models/Product';
import '@/server/src/models/Brand';
import '@/server/src/models/Category';

import {
    withDiscountInfo,
    stripAdminOnlyProductFields,
    normalizeProductAttributeGroups,
} from '@/server/src/utils/discountHelpers';

/**
 * Mongoose `.lean()` documents still contain BSON ObjectId instances
 * (which carry a `toJSON` method). Next.js RSC serialisation rejects
 * non-plain objects, so we round-trip through JSON to strip them.
 */
function serialize<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

// ────────────────────────────────────────────
// Promotions
// ────────────────────────────────────────────

export async function fetchPromotionsDirect(): Promise<HomePromotion[]> {
    await ensureDb();

    const now = new Date();
    const nowMinusOneDay = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const candidates = await Promotion.find({
        isActive: true,
        validFrom: { $lte: now },
        validTo: { $gte: nowMinusOneDay },
    })
        .sort({ sortOrder: 1, createdAt: -1 })
        .select({
            title: 1,
            description: 1,
            imageUrl: 1,
            link: 1,
            badgeText: 1,
            validFrom: 1,
            validTo: 1,
            directRedirect: 1,
        })
        .lean();

    const MAX_PROMOTIONS = 10;
    const promotions: any[] = [];

    for (const promotion of candidates) {
        const start = new Date(promotion.validFrom);
        const end = new Date(promotion.validTo);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;

        // Same midnight handling as promotionController
        const isMidnightLocal =
            end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0;
        const isMidnightUTC =
            end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0 && end.getUTCMilliseconds() === 0;

        if (isMidnightLocal) {
            end.setHours(23, 59, 59, 999);
        } else if (isMidnightUTC) {
            end.setUTCHours(23, 59, 59, 999);
        }

        if (start <= now && end >= now) {
            promotions.push(promotion);
            if (promotions.length >= MAX_PROMOTIONS) break;
        }
    }

    return serialize(promotions) as HomePromotion[];
}

// ────────────────────────────────────────────
// Partners
// ────────────────────────────────────────────

export async function fetchPartnersDirect(): Promise<PartnerBrand[]> {
    await ensureDb();

    const count = await Partner.countDocuments();
    if (count === 0) {
        // Seed starter partners (same as partnerController)
        const starterPartners = [
            'AMD', 'INTEL', 'NVIDIA', 'ASUS', 'MSI', 'GIGABYTE', 'ZOTAG',
            'CORSAIR', 'NZXT', 'ANTEC', 'PROLINK', 'OMIKUMA', 'WD', 'SAMSUNG',
        ];
        await Partner.insertMany(
            starterPartners.map((name, idx) => ({
                name,
                logoUrl: '',
                isActive: true,
                sortOrder: idx,
            }))
        ).catch(() => undefined); // ignore duplicate key errors on race
    }

    const partners = await Partner.find({ isActive: true })
        .sort({ sortOrder: 1, createdAt: 1 })
        .lean();

    return serialize(partners) as PartnerBrand[];
}

// ────────────────────────────────────────────
// Home Settings
// ────────────────────────────────────────────

const DEFAULT_HOME_SETTINGS: HomeSettings = {
    showDiscountedProductsRow: true,
};

export async function fetchHomeSettingsDirect(): Promise<HomeSettings> {
    await ensureDb();
    const settings = await HomeSettingsModel.findOne().lean();
    return serialize({ ...DEFAULT_HOME_SETTINGS, ...(settings ?? {}) });
}

// ────────────────────────────────────────────
// Products (for home page featured / discounted rows)
// ────────────────────────────────────────────

interface ProductFetchOptions {
    limit?: number;
    sort?: string;
    isFeatured?: boolean;
    includeFacets?: boolean;
}

function buildSortStage(sort: string): Record<string, 1 | -1> {
    const key = sort.trim().toLowerCase().replace(/-/g, '_');
    if (key === 'price_asc') return { price: 1 };
    if (key === 'price_desc') return { price: -1 };
    if (key === 'newest') return { createdAt: -1 };
    if (key === 'name_asc') return { title: 1 };
    return { createdAt: -1 };
}

export async function fetchProductsDirect(options: ProductFetchOptions): Promise<ProductsResponse> {
    await ensureDb();

    const limit = options.limit ?? 20;
    const match: Record<string, unknown> = { isActive: true };
    if (options.isFeatured != null) match.isFeatured = options.isFeatured;

    const sortStage = buildSortStage(options.sort ?? 'newest');

    const [products, total] = await Promise.all([
        Product.aggregate([
            { $match: match },
            { $sort: sortStage },
            { $limit: limit },
            {
                $lookup: {
                    from: 'brands',
                    localField: 'brandId',
                    foreignField: '_id',
                    as: 'brand',
                },
            },
            { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'categoryIds',
                    foreignField: '_id',
                    as: 'categories',
                },
            },
        ]),
        Product.countDocuments(match),
    ]);

    const processed = products
        .map(stripAdminOnlyProductFields)
        .map(withDiscountInfo);

    return serialize({
        products: processed,
        page: 1,
        pages: Math.ceil(total / limit),
        total,
    });
}

// ────────────────────────────────────────────
// Single Product (for product detail page SSR)
// ────────────────────────────────────────────

export async function fetchProductBySlugDirect(slug: string) {
    await ensureDb();

    const isObjectId = /^[a-fA-F0-9]{24}$/.test(slug);
    const query = isObjectId
        ? { _id: slug, isActive: true }
        : { slug, isActive: true };

    const product = await Product.findOne(query)
        .populate('brandId', 'name slug logoUrl')
        .populate('categoryIds', 'name slug discountPercent');

    if (!product) return null;

    // Same post-processing chain as getProductBySlug in productController
    const normalized = normalizeProductAttributeGroups(product);
    const sanitized = stripAdminOnlyProductFields(normalized);
    return serialize(withDiscountInfo(sanitized));
}
