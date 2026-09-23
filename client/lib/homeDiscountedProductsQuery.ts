import { getProductsQueryOptions, type UseProductsOptions } from "@/hooks/useProducts";

export const HOME_DISCOUNTED_PRODUCTS_OPTIONS: UseProductsOptions = {
    limit: 48,
    sort: "newest",
    includeFacets: false,
    // Filter at the query level instead of sampling the newest 48 products and
    // hoping some are discounted — that missed older products whose discount
    // comes from a category-wide discount rather than their own createdAt.
    hasDiscount: true,
};

export function getHomeDiscountedProductsQueryOptions() {
    return getProductsQueryOptions(HOME_DISCOUNTED_PRODUCTS_OPTIONS);
}
