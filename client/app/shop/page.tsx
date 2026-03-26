"use client";

import { useState, useEffect, useRef, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useProducts, useProductFacets } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import DynamicFilterSidebar, { countActiveFilters } from "@/components/DynamicFilterSidebar";
import LoadingAnimation from "@/components/LoadingAnimation";
import { SlidersHorizontal, ArrowUpDown, X, ChevronLeft, ChevronRight, Search } from "lucide-react";

const PRODUCTS_PER_PAGE = 15;
const SEARCH_DEBOUNCE_MS = 380;
const SHOP_RETURN_STATE_PREFIX = "shop:return-state:";

type Filters = Record<string, any>;

const DEFAULT_FILTERS: Filters = { search: "", sort: "newest", page: 1 };

interface ShopContentProps {
    basePath?: string;
    initialFilters?: Filters;
    /** Page title shown above filters + grid */
    heading?: string;
    /** Short line under the title */
    subheading?: string;
}

export function ShopContent({
    basePath = "/shop",
    initialFilters,
    heading,
    subheading,
}: ShopContentProps) {
    const returnStateStorageKey = `${SHOP_RETURN_STATE_PREFIX}${basePath}`;

    // Compute the starting filter state exactly once on mount.
    const [filters, setFilters] = useState<Filters>(() => {
        // If we are returning from a product page, restore the saved state.
        if (typeof window !== "undefined") {
            const pending = window.sessionStorage.getItem(`${returnStateStorageKey}:pending`);
            const raw = window.sessionStorage.getItem(returnStateStorageKey);
            if (pending === "1" && raw) {
                window.sessionStorage.removeItem(`${returnStateStorageKey}:pending`);
                try { return JSON.parse(raw) as Filters; } catch { /* fall through */ }
            }
        }
        return { ...DEFAULT_FILTERS, ...(initialFilters ?? {}) };
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchDraft, setSearchDraft] = useState(() => String(filters.search ?? ""));
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    const rememberCurrentShopState = useCallback(() => {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem(returnStateStorageKey, JSON.stringify(filtersRef.current));
        window.sessionStorage.setItem(`${returnStateStorageKey}:pending`, "1");
    }, [returnStateStorageKey]);

    // Fetch products first (fast path without expensive facets aggregation)
    const {
        data,
        isLoading,
        isFetching,
        error,
        refetch: refetchProducts,
    } = useProducts({
        ...filters,
        limit: PRODUCTS_PER_PAGE,
        includeFacets: false,
    });
    // Fetch facets asynchronously so grid can render sooner
    const {
        data: facetsData,
        refetch: refetchFacets,
    } = useProductFacets(filters);
    const products = data?.products || [];
    const facets = (facetsData as any)?.facets || {};

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

    // If the admin updates products/discounts, refetch immediately so discounts are reflected.
    useEffect(() => {
        const onAdminProductsUpdated = () => {
            void refetchProducts();
            void refetchFacets();
        };
        window.addEventListener("admin-products-updated", onAdminProductsUpdated as EventListener);
        return () => {
            window.removeEventListener("admin-products-updated", onAdminProductsUpdated as EventListener);
        };
    }, [refetchProducts, refetchFacets]);

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
    }, [data, facets.specs, filters.spec]);

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

    const commitSearch = useCallback(
        (raw: string) => {
            const q = raw.trim();
            const next = { ...filtersRef.current, search: q, page: 1 };
            setFilters(next);
        },
        []
    );

    const flushSearchDebounce = useCallback(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = null;
        }
    }, []);

    useEffect(() => () => flushSearchDebounce(), [flushSearchDebounce]);

    const onSearchInputChange = (value: string) => {
        setSearchDraft(value);
        flushSearchDebounce();
        searchDebounceRef.current = setTimeout(() => {
            searchDebounceRef.current = null;
            commitSearch(value);
        }, SEARCH_DEBOUNCE_MS);
    };

    const clearSearch = () => {
        flushSearchDebounce();
        setSearchDraft("");
        commitSearch("");
    };

    const goToPage = (page: number) => setFilters((prev: Filters) => ({ ...prev, page }));

    const pagination = (data as { pagination?: { page: number; pages: number; total: number } })?.pagination;
    const currentPage = pagination?.page ?? (data as { page?: number })?.page ?? 1;
    const totalPages = pagination?.pages ?? (data as { pages?: number })?.pages ?? 1;
    const totalProducts = pagination?.total ?? (data as { total?: number })?.total;
    const showPagination = totalPages > 1 && !isLoading && !error;
    const shopProductCardProps = {
        showWhatsAppButton: false,
        showOrderNowButton: true,
        onNavigateToProduct: rememberCurrentShopState,
    } as const;

    const getPageNumbers = () => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | "ellipsis")[] = [];
        if (currentPage <= 4) {
            pages.push(1, 2, 3, 4, 5, "ellipsis", totalPages);
        } else if (currentPage >= totalPages - 3) {
            pages.push(1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
        } else {
            pages.push(1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages);
        }
        return pages;
    };

    return (
        <div className="space-y-8 sm:space-y-10">
            <header className="space-y-5 sm:space-y-6">
                {(heading || subheading) && (
                    <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8E8E]">
                            Catalog
                        </p>
                        {heading && (
                            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F1F1F1]">
                                {heading}
                            </h1>
                        )}
                        {subheading && (
                            <p
                                className="max-w-2xl text-sm font-medium leading-relaxed text-[#B0B0B0] sm:text-base"
                            >
                                {subheading}
                            </p>
                        )}
                    </div>
                )}
                <form
                    role="search"
                    className="max-w-2xl"
                    onSubmit={(e) => {
                        e.preventDefault();
                        flushSearchDebounce();
                        commitSearch(searchDraft);
                    }}
                >
                    <label className="sr-only" htmlFor="shop-search">
                        Search products
                    </label>
                    <div className="group relative flex min-h-[3rem] items-center gap-3 rounded-2xl border border-[#5E5E5E]/50 bg-[#1a1a1a] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] focus-within:border-[#D12B28]/60 focus-within:shadow-[0_0_0_3px_rgba(209,43,40,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] sm:min-h-[3.25rem] sm:px-4 sm:py-2.5">
                        <Search
                            className="pointer-events-none h-5 w-5 shrink-0 text-[#8E8E8E] transition-colors group-focus-within:text-[#D12B28]"
                            aria-hidden
                        />
                        <input
                            id="shop-search"
                            type="text"
                            name="q"
                            enterKeyHint="search"
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            placeholder="Search by name, brand, or specs…"
                            value={searchDraft}
                            onChange={(e) => onSearchInputChange(e.target.value)}
                            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-base text-[#F1F1F1] caret-[#D12B28] placeholder:text-[#8E8E8E] focus:outline-none focus:ring-0 sm:text-[1.05rem]"
                        />
                        {searchDraft ? (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="rounded-lg p-1.5 text-[#8E8E8E] transition-colors hover:bg-white/10 hover:text-[#F1F1F1]"
                                aria-label="Clear search"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        ) : null}
                    </div>
                </form>
            </header>

            <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 lg:items-start">
                {/* Sidebar Toggle (Mobile) */}
                <div className="lg:hidden flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full border border-[#5E5E5E]/55 bg-[#242424]/80 px-4 py-2.5 text-sm font-medium text-[#F1F1F1] transition-colors hover:border-[#D12B28]/45 hover:bg-[#2a2a2a]"
                    >
                        <SlidersHorizontal className="h-4 w-4 text-[#B0B0B0]" />
                        Filters
                        {activeFilterCount > 0 && (
                            <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent/25 text-accent text-xs font-semibold flex items-center justify-center tabular-nums">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                <DynamicFilterSidebar
                    facets={facets}
                    filters={filters}
                    setFilters={setFilters}
                    isOpen={isSidebarOpen}
                    onClose={() => setIsSidebarOpen(false)}
                />

                <div className="flex-1 min-w-0 space-y-6">
                    <div className="sticky top-14 z-20 -mx-1 px-1 py-3 sm:static sm:z-0 sm:mx-0 sm:px-0 sm:py-0 bg-gradient-to-b from-[#121212] via-[#121212] to-transparent sm:bg-none">
                        <div className="flex flex-col gap-3 rounded-2xl border border-[#5E5E5E]/35 bg-[#242424]/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 backdrop-blur-sm">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                {!isLoading && !error && totalProducts != null && (
                                    <p className="text-sm text-[#8E8E8E]">
                                        <span className="font-medium tabular-nums text-[#F1F1F1]">{totalProducts}</span>
                                        <span className="text-[#8E8E8E]">
                                            {" "}
                                            product{totalProducts !== 1 ? "s" : ""}
                                        </span>
                                    </p>
                                )}
                                {isFetching && !isLoading && (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-[#D12B28]/30 bg-[#D12B28]/10 px-2.5 py-1 text-xs text-[#F4C5C5]">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-[#D12B28]" />
                                        Updating...
                                    </div>
                                )}
                                {activeFilterCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
                                    >
                                        <X className="h-3 w-3" />
                                        Clear {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}
                                    </button>
                                )}
                            </div>
                            <label className="flex items-center gap-2 text-[#8E8E8E] text-xs font-medium uppercase tracking-wider sm:text-sm sm:normal-case sm:tracking-normal sm:font-normal">
                                <ArrowUpDown className="hidden h-4 w-4 sm:block text-[#8E8E8E]" />
                                <span className="sr-only sm:not-sr-only sm:inline text-[#8E8E8E]">Sort</span>
                                <select
                                    aria-label="Sort products"
                                    value={filters.sort}
                                    onChange={(e) => {
                                        const sort = e.target.value;
                                        const next = { ...filtersRef.current, sort, page: 1 };
                                        setFilters(next);
                                    }}
                                    className="min-w-0 flex-1 sm:flex-none cursor-pointer rounded-xl border border-[#5E5E5E]/45 bg-[#121212]/90 px-3 py-2 text-sm font-normal text-[#F1F1F1] shadow-inner shadow-black/25 focus:outline-none focus:ring-2 focus:ring-[#D12B28]/40 focus:border-[#D12B28]/50 sm:min-w-[13rem]"
                                >
                                    {sortOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                            {[...Array(8)].map((_, i) => (
                                <div
                                    key={i}
                                    className="overflow-hidden rounded-2xl border border-[#5E5E5E]/25 bg-[#1a1a1a]/80"
                                >
                                    <div className="aspect-square animate-pulse bg-gradient-to-br from-zinc-800/80 to-zinc-900/40" />
                                    <div className="space-y-3 p-4">
                                        <div className="h-3 w-1/3 animate-pulse rounded-full bg-zinc-800" />
                                        <div className="h-4 w-full animate-pulse rounded-full bg-zinc-800/80" />
                                        <div className="h-4 w-2/3 animate-pulse rounded-full bg-zinc-800/80" />
                                        <div className="h-5 w-1/4 animate-pulse rounded-full bg-zinc-800" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-6 py-14 text-center">
                            <p className="text-base font-medium text-red-200">Couldn&apos;t load products</p>
                            <p className="mt-2 text-sm text-red-300/80">Check your connection and try again.</p>
                        </div>
                    ) : products.length === 0 ? (
                        <div className="rounded-2xl border border-[#5E5E5E]/35 bg-[#242424]/40 px-6 py-16 text-center">
                            <p className="text-base font-medium text-[#F1F1F1]">No products match your filters</p>
                            <p className="mt-2 text-sm text-[#8E8E8E] max-w-sm mx-auto">
                                Try clearing filters or broadening your search.
                            </p>
                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#5E5E5E]/50 bg-[#242424]/80 px-4 py-2 text-sm font-medium text-[#F1F1F1] transition-colors hover:border-[#D12B28]/45"
                                >
                                    Reset filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="relative">
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
                                {products.map((product) => (
                                    <ProductCard
                                        key={product._id}
                                        product={product}
                                        {...shopProductCardProps}
                                    />
                                ))}
                                </div>
                                {isFetching && (
                                    <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-[#121212]/55 backdrop-blur-[1px]">
                                        <LoadingAnimation
                                            size="sm"
                                            label="Refreshing products..."
                                            className="h-full"
                                        />
                                    </div>
                                )}
                            </div>

                            {showPagination && (
                                <nav
                                    className="flex flex-col items-center gap-4 border-t border-[#5E5E5E]/30 pt-10 sm:flex-row sm:justify-center"
                                    aria-label="Pagination"
                                >
                                    <div className="flex items-center gap-1 rounded-full border border-[#5E5E5E]/40 bg-[#242424]/60 p-1">
                                        <button
                                            type="button"
                                            onClick={() => goToPage(currentPage - 1)}
                                            disabled={currentPage <= 1}
                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                                currentPage <= 1
                                                    ? "cursor-not-allowed text-[#5E5E5E]"
                                                    : "text-[#F1F1F1] hover:bg-white/10"
                                            }`}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            <span className="hidden sm:inline">Prev</span>
                                        </button>
                                        <div className="flex items-center gap-0.5 px-1">
                                            {getPageNumbers().map((p, i) =>
                                                p === "ellipsis" ? (
                                                    <span key={`ellipsis-${i}`} className="px-2 text-sm text-[#8E8E8E]">
                                                        …
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        key={p}
                                                        onClick={() => goToPage(p as number)}
                                                        className={`flex h-9 min-w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                                                            p === currentPage
                                                                ? "bg-[#D12B28] text-[#F1F1F1] shadow-sm shadow-[#D12B28]/25"
                                                                : "text-[#B0B0B0] hover:bg-white/10"
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                )
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => goToPage(currentPage + 1)}
                                            disabled={currentPage >= totalPages}
                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                                                currentPage >= totalPages
                                                    ? "cursor-not-allowed text-[#5E5E5E]"
                                                    : "text-[#F1F1F1] hover:bg-white/10"
                                            }`}
                                        >
                                            <span className="hidden sm:inline">Next</span>
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="text-xs text-[#8E8E8E]">
                                        Page {currentPage} of {totalPages}
                                    </p>
                                </nav>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ShopSkeleton() {
    return (
        <div className="space-y-10 animate-pulse">
            <div className="space-y-5">
                <div className="space-y-3">
                    <div className="h-3 w-24 rounded-full bg-zinc-800" />
                    <div className="h-10 w-2/3 max-w-md rounded-xl bg-zinc-800" />
                    <div className="h-4 w-full max-w-lg rounded-lg bg-zinc-800/60" />
                </div>
                <div className="h-12 max-w-2xl rounded-2xl bg-zinc-800/80" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-white/[0.05] bg-white/[0.03]">
                        <div className="aspect-square bg-zinc-800/50" />
                        <div className="space-y-2 p-4">
                            <div className="h-3 w-1/3 rounded-full bg-zinc-800" />
                            <div className="h-4 w-full rounded-full bg-zinc-800/80" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ShopPage() {
    const searchParams = useSearchParams();
    const initialSearch = (searchParams?.get("search") ?? searchParams?.get("q") ?? "").trim();

    return (
        <div className="min-h-screen bg-[#121212] pb-16 pt-6 sm:pt-10">
            <div
                className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_85%_55%_at_50%_-25%,rgba(209,43,40,0.16),transparent_55%)]"
                aria-hidden
            />
            <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
                <Suspense fallback={<ShopSkeleton />}>
                    <ShopContent
                        heading="Shop"
                        initialFilters={{ search: initialSearch }}
                    />
                </Suspense>
            </div>
        </div>
    );
}
