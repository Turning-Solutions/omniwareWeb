import { getProductsQueryOptions, type UseProductsOptions } from "@/hooks/useProducts";

export const HOME_FEATURED_PRODUCTS_OPTIONS: UseProductsOptions = {
    limit: 16,
    sort: "newest",
    isFeatured: true,
    includeFacets: false,
};

export function getHomeFeaturedProductsQueryOptions() {
    return getProductsQueryOptions(HOME_FEATURED_PRODUCTS_OPTIONS);
}

