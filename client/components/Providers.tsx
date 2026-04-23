"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from "@/context/CartContext";
import { getProductsQueryOptions } from '@/hooks/useProducts';

const SHOP_PREFETCH_OPTIONS = {
    limit: 16,
    sort: 'newest',
    page: 1,
    includeFacets: false,
} as const;

function ShopProductsPreloader({ queryClient }: { queryClient: QueryClient }) {
    const hasPrefetchedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined' || hasPrefetchedRef.current) return;

        const runPrefetch = () => {
            if (hasPrefetchedRef.current) return;
            hasPrefetchedRef.current = true;
            void queryClient.prefetchQuery({
                ...getProductsQueryOptions(SHOP_PREFETCH_OPTIONS),
                staleTime: 2 * 60 * 1000,
            });
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
    }, [queryClient]);

    return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

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
