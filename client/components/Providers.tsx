"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from "@/context/CartContext";
import { getProductsQueryOptions, getProductFacetsQueryOptions } from '@/hooks/useProducts';
import { SHOP_PRODUCTS_PER_PAGE } from '@/lib/shopConstants';
import api from '@/lib/api';

const SHOP_LIST_STALE_MS = 2 * 60 * 1000;
const CATEGORY_TREE_STALE_MS = 5 * 60 * 1000;

/**
 * Default query options that exactly match what ShopContent uses on first render
 * (no filters, newest sort, page 1).
 */
const SHOP_LIST_OPTIONS = {
    search: '',
    limit: SHOP_PRODUCTS_PER_PAGE,
    sort: 'newest',
    page: 1,
    includeFacets: false,
} as const;

/**
 * Facets options mirror what ShopContent derives from DEFAULT_FILTERS:
 *   filters = { search:'', sort:'newest', page:1 }
 *   facetsFilters = omit(page, sort) → { search:'' }
 *   facetsMode = 'lite'  (no narrowing filters)
 */
const SHOP_FACETS_OPTIONS = {
    search: '',
    facetMode: 'lite' as const,
};

function ShopProductsPreloader({ queryClient }: { queryClient: QueryClient }) {
    const hasPrefetchedRef = useRef(false);
    const router = useRouter();

    useEffect(() => {
        if (typeof window === 'undefined' || hasPrefetchedRef.current) return;

        // Tell Next.js to download the /shop JS bundle in the background immediately.
        // This is free — no API call, just a script tag hint.
        router.prefetch('/shop');

        const runPrefetch = () => {
            if (hasPrefetchedRef.current) return;
            hasPrefetchedRef.current = true;

            // ── 1. Product list (page 1, newest, no filters) ──────────────────────
            const listOpts = getProductsQueryOptions(SHOP_LIST_OPTIONS);
            const listState = queryClient.getQueryState(listOpts.queryKey);
            const isListFresh =
                listState?.dataUpdatedAt != null &&
                Date.now() - listState.dataUpdatedAt < SHOP_LIST_STALE_MS;
            if (!isListFresh) {
                void queryClient.prefetchQuery({ ...listOpts, staleTime: SHOP_LIST_STALE_MS });
            }

            // ── 2. Facets (lite mode — drives filter sidebar counts) ───────────────
            const facetsOpts = getProductFacetsQueryOptions(SHOP_FACETS_OPTIONS);
            const facetsState = queryClient.getQueryState(facetsOpts.queryKey);
            const isFacetsFresh =
                facetsState?.dataUpdatedAt != null &&
                Date.now() - facetsState.dataUpdatedAt < SHOP_LIST_STALE_MS;
            if (!isFacetsFresh) {
                void queryClient.prefetchQuery({ ...facetsOpts, staleTime: SHOP_LIST_STALE_MS });
            }

            // ── 3. Category tree (drives sidebar category/subcategory rows) ────────
            const categoryTreeKey = ['shop-category-tree'] as const;
            const treeState = queryClient.getQueryState(categoryTreeKey);
            const isTreeFresh =
                treeState?.dataUpdatedAt != null &&
                Date.now() - treeState.dataUpdatedAt < CATEGORY_TREE_STALE_MS;
            if (!isTreeFresh) {
                void queryClient.prefetchQuery({
                    queryKey: categoryTreeKey,
                    queryFn: async () => {
                        const { data } = await api.get('/products/categories');
                        return Array.isArray(data) ? data : [];
                    },
                    staleTime: CATEGORY_TREE_STALE_MS,
                });
            }
        };

        const schedulePrefetch = () => {
            if (
                typeof globalThis.requestIdleCallback === 'function' &&
                typeof globalThis.cancelIdleCallback === 'function'
            ) {
                const idleId = globalThis.requestIdleCallback(() => runPrefetch(), { timeout: 2000 });
                return () => globalThis.cancelIdleCallback(idleId);
            }
            const timeoutId = globalThis.setTimeout(runPrefetch, 250);
            return () => globalThis.clearTimeout(timeoutId);
        };

        if (document.readyState === 'complete') {
            return schedulePrefetch();
        }

        let cancelScheduled: (() => void) | undefined;
        const onLoad = () => {
            cancelScheduled = schedulePrefetch();
        };
        window.addEventListener('load', onLoad, { once: true });

        return () => {
            window.removeEventListener('load', onLoad);
            cancelScheduled?.();
        };
    }, [queryClient, router]);

    return null;
}

const DEFAULT_QUERY_STALE_MS = 2 * 60 * 1000;
const DEFAULT_GC_MS = 30 * 60 * 1000;

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: DEFAULT_QUERY_STALE_MS,
                        gcTime: DEFAULT_GC_MS,
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <ShopProductsPreloader queryClient={queryClient} />
            <CartProvider>
                {children}
                <Toaster position="bottom-right" toastOptions={{
                    style: {
                        background: '#1E1E1E',
                        color: '#fff',
                        border: '1px solid #333'
                    }
                }} />
            </CartProvider>
        </QueryClientProvider>
    );
}
