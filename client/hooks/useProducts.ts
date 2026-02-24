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
}

export interface Product {
    _id: string;
    slug?: string;
    title: string;
    description: string;
    price: number;
    images: string[];
    category: string;
    categoryIds?: { _id: string; name: string }[];
    brand: string | { name: string; _id: string }; // Can be string or populated object
    brandId?: { _id: string; name: string } | string;
    countInStock: number;
    rating: number;
    numReviews: number;
    stock?: { qty: number };
    variants?: any[];
    specs?: Record<string, string>;
    attributes?: { name: string; value: string }[];
    /** Grouped attributes for product details (e.g. General, Cable Specs). Falls back to attributes as one group. */
    attributeGroups?: { category: string; attributes: { name: string; value: string }[] }[];
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

function buildProductsQueryString(options: UseProductsOptions): string {
    const params = new URLSearchParams();
    // Always send limit so server returns full facets when limit >= 20 (shop page)
    const limit = options.limit ?? 20;
    params.append('limit', limit.toString());
    if (options.sort) params.append('sort', options.sort);
    if (options.search) params.append('search', options.search);
    if (options.category) params.append('category', options.category);
    if (options.brand) params.append('brand', options.brand);
    if (options.minPrice != null) params.append('minPrice', options.minPrice.toString());
    if (options.maxPrice != null) params.append('maxPrice', options.maxPrice.toString());
    if (options.page) params.append('page', options.page.toString());
    if (options.availability) params.append('availability', options.availability);
    if (options.inStock) params.append('inStock', options.inStock);
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
