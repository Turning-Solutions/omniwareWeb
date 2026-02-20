"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { CartProvider } from "@/context/CartContext";

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient());

    return (
        <QueryClientProvider client={queryClient}>
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
