"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import api from "@/lib/api";
import type { Product } from "@/hooks/useProducts";

/**
 * Prefetch a single product's detail data into React Query cache on hover.
 * When the user clicks through, useProduct(slug) finds cached data → no spinner.
 *
 * Usage:
 *   const { onMouseEnter } = usePrefetchProduct(product.slug);
 *   <div onMouseEnter={onMouseEnter}>...</div>
 */
export function usePrefetchProduct(slugOrId: string | undefined) {
    const queryClient = useQueryClient();
    const prefetchedRef = useRef<Set<string>>(new Set());

    const onMouseEnter = useCallback(() => {
        if (!slugOrId) return;
        // Only prefetch once per slug per session
        if (prefetchedRef.current.has(slugOrId)) return;
        prefetchedRef.current.add(slugOrId);

        void queryClient.prefetchQuery<Product>({
            queryKey: ["product", slugOrId],
            queryFn: async () => {
                const { data } = await api.get(`/products/${slugOrId}`);
                return data;
            },
            staleTime: 5 * 60 * 1000,
        });
    }, [slugOrId, queryClient]);

    return { onMouseEnter };
}

/**
 * Prefetch shop page products on hover (e.g. hovering "Shop" link in navbar).
 * Uses the same query key shape as useProducts so the shop page hydrates instantly.
 */
export function usePrefetchShopProducts() {
    const queryClient = useQueryClient();
    const prefetchedRef = useRef(false);

    const onMouseEnter = useCallback(() => {
        if (prefetchedRef.current) return;
        prefetchedRef.current = true;

        void queryClient.prefetchQuery({
            queryKey: ["products", { limit: 20, sort: "newest", page: 1, includeFacets: false }],
            queryFn: async () => {
                const { data } = await api.get("/products?limit=20&sort=newest&page=1&facets=false");
                return data;
            },
            staleTime: 2 * 60 * 1000,
        });
    }, [queryClient]);

    return { onMouseEnter };
}
