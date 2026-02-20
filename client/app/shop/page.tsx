"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import DynamicFilterSidebar, { countActiveFilters } from "@/components/DynamicFilterSidebar";
import { SlidersHorizontal, ArrowUpDown, X } from "lucide-react";

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

    const activeFilterCount = countActiveFilters(filters);
    const sortOptions = [
        { value: "newest", label: "Newest" },
        { value: "price-asc", label: "Price: Low to High" },
        { value: "price-desc", label: "Price: High to Low" },
        { value: "name-asc", label: "Name: A–Z" },
    ] as const;

    const clearFilters = () => {
        setFilters((prev: Record<string, unknown>) => ({
            search: prev.search,
            sort: prev.sort,
            page: 1,
        }));
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Toggle (Mobile) */}
            <div className="lg:hidden flex items-center gap-3">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-colors font-medium"
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center">
                            {activeFilterCount}
                        </span>
                    )}
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

            {/* Product Grid + Toolbar */}
            <div className="flex-1 min-w-0">
                {/* Toolbar: sort + active filters */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-sub text-sm">
                            <ArrowUpDown className="h-4 w-4" />
                            <span className="sr-only">Sort by</span>
                            <select
                                value={filters.sort}
                                onChange={(e) => setFilters((prev: Record<string, unknown>) => ({ ...prev, sort: e.target.value, page: 1 }))}
                                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                            >
                                {sortOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </label>
                        {activeFilterCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 transition-colors"
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
                            </button>
                        )}
                    </div>
                    {!isLoading && !error && (
                        <p className="text-sm text-sub">
                            {data?.total != null ? `${data.total} product${data.total !== 1 ? "s" : ""}` : ""}
                        </p>
                    )}
                </div>

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
        <div className="min-h-screen bg-black pt-20 pb-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-white mb-8">Shop All Products</h1>
                <Suspense fallback={<div className="text-main text-center pt-20">Loading Shop...</div>}>
                    <ShopContent />
                </Suspense>
            </div>
        </div>
    );
}
