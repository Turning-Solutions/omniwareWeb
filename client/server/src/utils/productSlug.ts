import Product from '../models/Product';

export function normalizeProductSlugInput(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

export function getProductSlug(value: unknown): string {
    if (!value || typeof value !== "object" || !("slug" in value)) return "";
    const slug = (value as { slug?: unknown }).slug;
    return typeof slug === "string" ? slug.trim() : "";
}

export function isObjectIdString(value: string): boolean {
    return /^[a-fA-F0-9]{24}$/.test(value);
}

/** True when the product should get a new SEO slug from its title. */
export function productNeedsSlugBackfill(product: { _id: unknown; slug?: unknown }): boolean {
    const id = String(product._id);
    const slug = getProductSlug(product);
    if (!slug) return true;
    if (slug === id) return true;
    if (isObjectIdString(slug)) return true;
    return false;
}

export async function createUniqueProductSlug(value: unknown, excludeId?: string): Promise<string> {
    const baseSlug = normalizeProductSlugInput(value) || "product";
    let candidate = baseSlug;
    let suffix = 2;

    while (await Product.exists({
        slug: candidate,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })) {
        candidate = `${baseSlug}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}

export type ProductSlugBackfillResult = {
    dryRun: boolean;
    scanned: number;
    updated: number;
    skipped: number;
    activeUpdated: number;
    inactiveUpdated: number;
    errors: Array<{ id: string; title: string; message: string }>;
    samples: Array<{ id: string; from: string; to: string; isActive: boolean }>;
};

export async function backfillProductSlugs(options?: {
    dryRun?: boolean;
    /** When true, only active products are updated. Default updates active and inactive. */
    activeOnly?: boolean;
}): Promise<ProductSlugBackfillResult> {
    const dryRun = options?.dryRun ?? false;
    const match: Record<string, unknown> = options?.activeOnly ? { isActive: true } : {};

    const products = await Product.find(match)
        .select("title slug _id isActive")
        .sort({ updatedAt: -1 })
        .lean();

    let updated = 0;
    let skipped = 0;
    let activeUpdated = 0;
    let inactiveUpdated = 0;
    const errors: ProductSlugBackfillResult["errors"] = [];
    const samples: ProductSlugBackfillResult["samples"] = [];

    for (const product of products) {
        if (!productNeedsSlugBackfill(product)) {
            skipped += 1;
            continue;
        }

        const id = String(product._id);
        const from = getProductSlug(product) || id;
        const title = typeof product.title === "string" ? product.title : "product";
        const isActive = product.isActive === true;

        try {
            const nextSlug = await createUniqueProductSlug(title, id);
            if (!dryRun) {
                await Product.updateOne({ _id: product._id }, { $set: { slug: nextSlug } });
            }
            updated += 1;
            if (isActive) {
                activeUpdated += 1;
            } else {
                inactiveUpdated += 1;
            }
            if (samples.length < 25) {
                samples.push({ id, from, to: nextSlug, isActive });
            }
        } catch (error) {
            errors.push({
                id,
                title,
                message: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }

    return {
        dryRun,
        scanned: products.length,
        updated,
        skipped,
        activeUpdated,
        inactiveUpdated,
        errors,
        samples,
    };
}
