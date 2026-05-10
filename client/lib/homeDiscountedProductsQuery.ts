import { getProductsQueryOptions, type UseProductsOptions } from "@/hooks/useProducts";

export const HOME_DISCOUNTED_PRODUCTS_OPTIONS: UseProductsOptions = {
    limit: 48,
    sort: "newest",
    includeFacets: false,
};

export function getHomeDiscountedProductsQueryOptions() {
    return getProductsQueryOptions(HOME_DISCOUNTED_PRODUCTS_OPTIONS);
}
