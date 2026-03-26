import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export interface UseProductsOptions {
    limit?: number;
    sort?: string;
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    /** Spec filters e.g. { vram: '16GB', chipset: 'RTX 4070' } — sent as spec[key]=value */
    spec?: Record<string, string>;
    availability?: string;
    inStock?: string;
    isFeatured?: boolean;
    includeFacets?: boolean;
}

export interface Product {
    _id: string;
    slug?: string;
    title: string;
    description: string;
    price: number;
    /**
     * Original price stored in DB.
     * (Kept as `price` in DB responses; we also expose `originalPrice` for safety.)
     */
    originalPrice?: number;
    /** Effective price after applying product/category discounts. */
    discountedPrice?: number;
    /** Discount percent actually applied to the customer (0/null if none). */
    effectiveDiscountPercent?: number | null;
    /** Product-level override discount percent (null if not set). */
    discountPercent?: number | null;
    images: string[];
    category: string;
    categoryIds?: { _id: string; name: string }[];
    brand: string | { name: string; _id: string }; // Can be string or populated object
    brandId?: { _id: string; name: string } | string;
    countInStock: number;
    rating: number;
    numReviews: number;
    stock?: { qty: number };
    availability?: 'in_stock' | 'out_of_stock' | 'pre_order' | 'coming_soon';
    variants?: {
        sku?: string;
        price?: number;
        stock?: { qty?: number };
        attributes?: { name?: string; value: string }[];
    }[];
    colorVariants?: {
        name: string;
        hex?: string;
        image?: string;
        sku?: string;
        price?: number;
        stock?: { qty?: number };
    }[];
    warranty?: string;
    isFeatured?: boolean;
    specs?: Record<string, string>;
    attributes?: { name?: string; value: string }[];
    /** Grouped attributes for product details (e.g. General, Cable Specs). Falls back to attributes as one group. */
    attributeGroups?: { category: string; attributes: { name?: string; value: string }[] }[];
}

interface ProductsResponse {
    products: Product[];
    page: number;
    pages: number;
    total: number;
}

export interface Facets {
    price?: { min: number; max: number };
    categories?: { value: string; label: string; count: number }[];
    brands?: { value: string; label: string; count: number }[];
    specs?: Record<string, { value: string; count: number }[]>;
    allowedFilters?: {
        price: boolean;
        availability: boolean;
        brand: boolean;
    };
}

/** Backend expects underscores (price_asc); shop UI / URLs use hyphens (price-asc). */
function normalizeSortForApi(sort: string): string {
    return sort.trim().toLowerCase().replace(/-/g, '_');
}

function buildProductsQueryString(options: UseProductsOptions): string {
    const params = new URLSearchParams();
    // Always send limit so server returns full facets when limit >= 20 (shop page)
    const limit = options.limit ?? 20;
    params.append('limit', limit.toString());
    if (options.sort) params.append('sort', normalizeSortForApi(options.sort));
    if (options.search) params.append('search', options.search);
    if (options.category) params.append('category', options.category);
    if (options.brand) params.append('brand', options.brand);
    if (options.minPrice != null) params.append('minPrice', options.minPrice.toString());
    if (options.maxPrice != null) params.append('maxPrice', options.maxPrice.toString());
    if (options.page) params.append('page', options.page.toString());
    if (options.availability) params.append('availability', options.availability);
    if (options.inStock) params.append('inStock', options.inStock);
    if (options.isFeatured != null) params.append('isFeatured', String(options.isFeatured));
    if (options.includeFacets === false) params.append('facets', 'false');
    // Spec filters: API expects spec[key]=value (e.g. spec[vram]=16GB)
    if (options.spec && typeof options.spec === 'object') {
        for (const [key, value] of Object.entries(options.spec)) {
            if (value != null && value !== '') params.append(`spec[${key}]`, value);
        }
    }
    return params.toString();
}

export const useProducts = (options: UseProductsOptions = {}) => {
    return useQuery<ProductsResponse>({
        queryKey: ['products', options],
        queryFn: async () => {
            const query = buildProductsQueryString(options);
            const { data } = await api.get(`/products?${query}`);
            return data;
        },
        staleTime: 2 * 60 * 1000, // 2 minutes — avoid refetch on every mount
        placeholderData: (previousData) => previousData, // show previous list while refetching
    });
};

export const useProductFacets = (options: UseProductsOptions = {}) => {
    return useQuery<{ facets: Facets }>({
        queryKey: ['product-facets', options],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (options.search) params.append('search', options.search);
            if (options.category) params.append('category', options.category);
            if (options.brand) params.append('brand', options.brand);
            if (options.minPrice != null) params.append('minPrice', options.minPrice.toString());
            if (options.maxPrice != null) params.append('maxPrice', options.maxPrice.toString());
            if (options.availability) params.append('availability', options.availability);
            if (options.inStock) params.append('inStock', options.inStock);
            if (options.isFeatured != null) params.append('isFeatured', String(options.isFeatured));
            if (options.spec && typeof options.spec === 'object') {
                for (const [key, value] of Object.entries(options.spec)) {
                    if (value != null && value !== '') params.append(`spec[${key}]`, value);
                }
            }
            const query = params.toString();
            const { data } = await api.get(`/products/facets${query ? `?${query}` : ''}`);
            return data;
        },
        staleTime: 2 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    });
};

export const useProduct = (slug: string) => {
    return useQuery<Product>({
        queryKey: ['product', slug],
        queryFn: async () => {
            const { data } = await api.get(`/products/${slug}`);
            return data;
        },
        enabled: !!slug,
        staleTime: 5 * 60 * 1000, // 5 minutes for single product
    });
};
