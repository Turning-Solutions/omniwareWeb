/**
 * Shared discount-calculation helpers.
 *
 * Extracted from productController so both Express routes and
 * Next.js server-component data fetchers can use them without
 * pulling in Express-specific code.
 */

function normalizeDiscountAmount(input: unknown): number | null {
    if (input == null) return null;
    const n = typeof input === 'number' ? input : Number(input);
    if (!Number.isFinite(n)) return null;
    if (n <= 0) return null;
    // Clamp to keep data safe even if someone bypasses UI/API validation
    return Math.max(0, n);
}

function computeEffectiveDiscountAmount(product: any): number | null {
    // 1) Product-level override wins
    const productOverride = normalizeDiscountAmount(product?.discountPercent);
    if (productOverride != null) return productOverride;

    // 2) Otherwise, apply the discount from the product's *first* category.
    // We support both API response shapes:
    // - aggregate list route: populated `categories` + raw `categoryIds`
    // - product detail route: populated `categoryIds` (with discountPercent)

    // If `categoryIds[0]` is already a populated category object, read its discount directly.
    if (Array.isArray(product?.categoryIds) && product.categoryIds.length > 0) {
        const first = product.categoryIds[0] as any;
        const direct = normalizeDiscountAmount(first?.discountPercent);
        if (direct != null) return direct;
    }

    const firstCategoryId =
        Array.isArray(product?.categoryIds) && product.categoryIds.length > 0
            ? product.categoryIds[0]
            : null;

    const categoriesFromLookup = Array.isArray(product?.categories) ? product.categories : [];
    if (firstCategoryId != null && categoriesFromLookup.length > 0) {
        const match = categoriesFromLookup.find(
            (c: any) => String(c?._id ?? '') === String(firstCategoryId)
        );
        return match ? normalizeDiscountAmount(match?.discountPercent) : null;
    }

    // Fallback: use the first category document if present (aggregate route only).
    if (categoriesFromLookup.length > 0) return normalizeDiscountAmount(categoriesFromLookup[0]?.discountPercent);

    return null;
}

export function withDiscountInfo(product: any): any {
    const originalPrice = typeof product?.price === 'number' ? product.price : Number(product?.price);
    if (!Number.isFinite(originalPrice)) {
        return { ...product, originalPrice: null, discountedPrice: null, effectiveDiscountPercent: null };
    }

    const effectiveDiscountAmount = computeEffectiveDiscountAmount(product);
    const discountedPrice =
        effectiveDiscountAmount != null
            ? Math.max(0, Math.round(originalPrice - effectiveDiscountAmount))
            : originalPrice;

    return {
        ...product,
        originalPrice,
        discountedPrice,
        effectiveDiscountPercent: effectiveDiscountAmount,
    };
}

export function stripAdminOnlyProductFields(product: any): any {
    if (!product || typeof product !== 'object') return product;
    const { dealerPrice: _dealerPrice, ...safeProduct } = product;
    return safeProduct;
}

/** Ensure attributeGroups is set for API response; use legacy attributes as "General" when needed */
export function normalizeProductAttributeGroups(doc: any): any {
    const pojo = doc && typeof doc.toObject === 'function' ? doc.toObject() : doc;
    if (!pojo) return pojo;
    // `specs` is stored as `Map` in Mongo. Ensure we serialize it as a plain object
    // so the admin UI can read values via `Object.entries`.
    if (pojo.specs && typeof pojo.specs === 'object') {
        if (pojo.specs instanceof Map) {
            pojo.specs = Object.fromEntries(pojo.specs.entries());
        } else if (typeof (pojo.specs as any).toObject === 'function') {
            pojo.specs = (pojo.specs as any).toObject();
        } else if (Array.isArray(pojo.specs)) {
            pojo.specs = {};
        }
    }
    if (pojo.attributeGroups && Array.isArray(pojo.attributeGroups) && pojo.attributeGroups.length > 0) {
        return pojo;
    }
    if (pojo.attributes && Array.isArray(pojo.attributes) && pojo.attributes.length > 0) {
        pojo.attributeGroups = [{ category: 'General', attributes: pojo.attributes }];
    } else {
        pojo.attributeGroups = [];
    }
    return pojo;
}
