import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface UseProductsOptions {
    limit?: number;
    sort?: string;
    search?: string;
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
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

export const useProducts = (options: UseProductsOptions = {}) => {
    return useQuery<ProductsResponse>({
        queryKey: ['products', options],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (options.limit) params.append('limit', options.limit.toString());
            if (options.sort) params.append('sort', options.sort);
            if (options.search) params.append('search', options.search);
            if (options.category) params.append('category', options.category);
            if (options.brand) params.append('brand', options.brand);
            if (options.minPrice) params.append('minPrice', options.minPrice.toString());
            if (options.maxPrice) params.append('maxPrice', options.maxPrice.toString());
            if (options.page) params.append('page', options.page.toString());

            const { data } = await api.get(`/products?${params.toString()}`);
            return data;
        },
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
    });
};
