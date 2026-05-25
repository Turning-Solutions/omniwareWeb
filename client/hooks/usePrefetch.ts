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
const PRODUCT_DETAIL_STALE_MS = 5 * 60 * 1000;

export function usePrefetchProduct(slugOrId: string | undefined) {
    const queryClient = useQueryClient();
    const prefetchedRef = useRef<Set<string>>(new Set());

    const onMouseEnter = useCallback(() => {
        if (!slugOrId) return;
        if (prefetchedRef.current.has(slugOrId)) return;

        // If the product detail is already fresh in the cache (e.g. seeded by SSR
        // hydration or a previous hover), mark it done and skip the network round-trip.
        const cached = queryClient.getQueryState(["product", slugOrId]);
        const isFresh =
            cached?.dataUpdatedAt != null &&
            Date.now() - cached.dataUpdatedAt < PRODUCT_DETAIL_STALE_MS;

        prefetchedRef.current.add(slugOrId);

        if (isFresh) return;

        void queryClient.prefetchQuery<Product>({
            queryKey: ["product", slugOrId],
            queryFn: async () => {
                const { data } = await api.get(`/products/${slugOrId}`);
                return data;
            },
            staleTime: PRODUCT_DETAIL_STALE_MS,
        });
    }, [slugOrId, queryClient]);

    return { onMouseEnter };
}

const SHOP_LIST_STALE_MS = 2 * 60 * 1000;

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

        // Skip if the default shop list is already fresh in cache.
        const queryKey = ["products", { limit: 20, sort: "newest", page: 1, includeFacets: false }] as const;
        const cached = queryClient.getQueryState(queryKey);
        const isFresh =
            cached?.dataUpdatedAt != null &&
            Date.now() - cached.dataUpdatedAt < SHOP_LIST_STALE_MS;
        if (isFresh) return;

        void queryClient.prefetchQuery({
            queryKey,
            queryFn: async () => {
                const { data } = await api.get("/products?limit=20&sort=newest&page=1&facets=false");
                return data;
            },
            staleTime: SHOP_LIST_STALE_MS,
        });
    }, [queryClient]);

    return { onMouseEnter };
}
