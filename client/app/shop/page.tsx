"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import DynamicFilterSidebar from "@/components/DynamicFilterSidebar";
import { SlidersHorizontal } from "lucide-react";

interface ShopContentProps {
    basePath?: string;
    initialFilters?: Record<string, any>;
}

export function ShopContent({ basePath = "/shop", initialFilters = {} }: ShopContentProps) {
    const searchParams = useSearchParams();

    // Initialize filters from URL or props
    const [filters, setFilters] = useState<Record<string, any>>({
        search: searchParams?.get("search") || "",
        sort: searchParams?.get("sort") || "newest",
        page: Number(searchParams?.get("page")) || 1,
        ...initialFilters
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Fetch products
    const { data, isLoading, error } = useProducts(filters);
    const products = data?.products || [];
    const facets = (data as any)?.facets || {};

    // Track previous category to detect changes
    const prevCategoryRef = useRef(filters.category);

    // Reset specs and brands when category changes
    useEffect(() => {
        if (prevCategoryRef.current !== filters.category) {
            setFilters(prev => {
                const next = { ...prev };
                delete next.spec;
                delete next.brand;
                return next;
            });
            prevCategoryRef.current = filters.category;
        }
    }, [filters.category]);

    // Keep state in sync with available specs (removes selected specs that are no longer in facets)
    useEffect(() => {
        if (!data || !facets.specs || !filters.spec) return;

        const currentSpecs = filters.spec;
        const availableKeys = Object.keys(facets.specs);
        let changed = false;

        const newSpecParams = { ...currentSpecs };
        for (const key of Object.keys(currentSpecs)) {
            if (!availableKeys.includes(key)) {
                delete newSpecParams[key];
                changed = true;
            }
        }

        if (changed) {
            setFilters((prev: any) => {
                const next = { ...prev };
                if (Object.keys(newSpecParams).length > 0) {
                    next.spec = newSpecParams;
                } else {
                    delete next.spec;
                }
                return next;
            });
        }
    }, [data, facets.specs]);

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Toggle (Mobile) */}
            <div className="lg:hidden mb-4">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
                >
                    <SlidersHorizontal className="h-4 w-4" /> Filters
                </button>
            </div>

            {/* Sidebar */}
            <DynamicFilterSidebar
                facets={facets}
                filters={filters}
                setFilters={setFilters}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />

            {/* Product Grid */}
            <div className="flex-1">
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-white/5 rounded-xl aspect-[3/4] animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center text-red-400 py-12">Failed to load products</div>
                ) : products.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">No products found</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {products.map((product) => (
                            <ProductCard key={product._id} product={product} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ShopPage() {
    return (
        <div className="min-h-screen bg-base pt-20 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-white mb-8">Shop All Products</h1>
                <Suspense fallback={<div className="text-main text-center pt-20">Loading Shop...</div>}>
                    <ShopContent />
                </Suspense>
            </div>
        </div>
    );
}
