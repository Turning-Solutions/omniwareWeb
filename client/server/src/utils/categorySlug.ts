import Category from '../models/Category';

export function normalizeCategorySlugInput(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/\bm[\s._-]*2\b/g, 'm2')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

/**
 * Category slugs are global and used elsewhere (shop URLs, featured-specs config) to identify
 * a category, so two categories can't share one — e.g. a subcategory named the same as its own
 * main category, or as an unrelated category. Append a numeric suffix on collision instead of
 * letting the save fail or silently colliding, mirroring createUniqueProductSlug.
 */
export async function createUniqueCategorySlug(value: unknown, excludeId?: string): Promise<string> {
    const baseSlug = normalizeCategorySlugInput(value) || 'category';
    let candidate = baseSlug;
    let suffix = 2;

    while (await Category.exists({
        slug: candidate,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })) {
        candidate = `${baseSlug}-${suffix}`;
        suffix += 1;
    }

    return candidate;
}
