"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
    getProductFacetsQueryOptions,
    getProductsQueryOptions,
    useProducts,
    useProductFacets,
    type Facets,
} from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import DynamicFilterSidebar, { countActiveFilters } from "@/components/DynamicFilterSidebar";
import LoadingAnimation from "@/components/LoadingAnimation";
import { SlidersHorizontal, ArrowUpDown, X, ChevronLeft, ChevronRight, Search, Loader2 } from "lucide-react";
import { SHOP_PRODUCTS_PER_PAGE } from "@/lib/shopConstants";
import { serializeShopListingUrl, shopListingUrlsEquivalent } from "@/lib/shopUrlFilters";
import { buildShopFilters, shopFacetsOptions, type ShopFilters } from "@/lib/shopFacetsQuery";
import api from "@/lib/api";

const SEARCH_DEBOUNCE_MS = 380;
const HOVER_PREFETCH_DEBOUNCE_MS = 180;
const SHOP_RETURN_STATE_PREFIX = "shop:return-state:";
const SHOP_LIST_STALE_MS = 2 * 60 * 1000;
const PRODUCT_DETAIL_STALE_MS = 5 * 60 * 1000;
const SHOP_AUTO_WARM_LIMIT = 8;
const INITIAL_VISIBLE_PRODUCTS = 8;
const PRODUCT_REVEAL_BATCH_SIZE = 4;
const PRODUCT_REVEAL_INTERVAL_MS = 60;
const FILTERS_REVEAL_DELAY_MS = 120;
/** Minimum time the grid overlay stays visible after a filter change (covers instant cache hits). */
const PRODUCTS_REFRESH_MIN_MS = 400;

type Filters = ShopFilters;

export interface ShopContentProps {
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
    const router = useRouter();
    const returnStateStorageKey = `${SHOP_RETURN_STATE_PREFIX}${basePath}`;

    // Compute the starting filter state exactly once on mount.
    const [filters, setFilters] = useState<Filters>(() => {
        // If we are returning from a product page, restore the saved state.
        if (typeof window !== "undefined") {
            const pending = window.sessionStorage.getItem(`${returnStateStorageKey}:pending`);
            const raw = window.sessionStorage.getItem(returnStateStorageKey);
            if (pending === "1" && raw) {
                window.sessionStorage.removeItem(`${returnStateStorageKey}:pending`);
                try {
                    return JSON.parse(raw) as Filters;
                } catch {
                    /* fall through */
                }
            }
        }
        return buildShopFilters(initialFilters);
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const productsTopRef = useRef<HTMLDivElement | null>(null);
    const [searchDraft, setSearchDraft] = useState(() => String(filters.search ?? ""));
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const filtersRef = useRef<Filters>(filters);
    const hoverPrefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastHoverPrefetchKeyRef = useRef<string>("");
    const warmedProductRoutesRef = useRef<Set<string>>(new Set());
    const hasShownFiltersRef = useRef(false);
    const [visibleProductsCount, setVisibleProductsCount] = useState(INITIAL_VISIBLE_PRODUCTS);
    const [showFiltersPanel, setShowFiltersPanel] = useState(false);

    const rememberCurrentShopState = useCallback(() => {
        if (typeof window === "undefined") return;
        window.sessionStorage.setItem(returnStateStorageKey, JSON.stringify(filtersRef.current));
        window.sessionStorage.setItem(`${returnStateStorageKey}:pending`, "1");
    }, [returnStateStorageKey]);

    const queryClient = useQueryClient();

    const prefetchShopListState = useCallback(
        (next: Filters) => {
            const listOpts = getProductsQueryOptions({
                ...next,
                limit: SHOP_PRODUCTS_PER_PAGE,
                includeFacets: false,
            });
            // Must match the live query key exactly — `next` still carries page/sort.
            const facetOpts = getProductFacetsQueryOptions(shopFacetsOptions(next));
            void queryClient.prefetchQuery({ ...listOpts, staleTime: SHOP_LIST_STALE_MS });
            void queryClient.prefetchQuery({ ...facetOpts, staleTime: SHOP_LIST_STALE_MS });
        },
        [queryClient]
    );

    const scheduleHoverPrefetch = useCallback(
        (key: string, next: Filters) => {
            if (lastHoverPrefetchKeyRef.current === key) return;

            // If the product-list data for this exact filter state is already fresh in the
            // React Query cache, there is no need to schedule a timer or fire any request.
            const listOpts = getProductsQueryOptions({
                ...next,
                limit: SHOP_PRODUCTS_PER_PAGE,
                includeFacets: false,
            });
            const listState = queryClient.getQueryState(listOpts.queryKey);
            const isListFresh =
                listState?.dataUpdatedAt != null &&
                Date.now() - listState.dataUpdatedAt < SHOP_LIST_STALE_MS;
            if (isListFresh) return;

            lastHoverPrefetchKeyRef.current = key;
            if (hoverPrefetchTimerRef.current) clearTimeout(hoverPrefetchTimerRef.current);
            hoverPrefetchTimerRef.current = setTimeout(() => {
                hoverPrefetchTimerRef.current = null;
                prefetchShopListState(next);
            }, HOVER_PREFETCH_DEBOUNCE_MS);
        },
        [queryClient, prefetchShopListState]
    );

    const prefetchCategoryHover = useCallback(
        (facetValue: string) => {
            const cur = filtersRef.current;
            let next: Filters;
            if (cur.category === facetValue) {
                next = { ...cur, page: 1 };
                delete next.category;
                delete next.subcategories;
                delete next.brand;
                delete next.spec;
            } else {
                next = { ...cur, category: facetValue, page: 1 };
                delete next.subcategories;
                delete next.brand;
                delete next.spec;
            }
            scheduleHoverPrefetch(`cat:${facetValue}:${cur.category === facetValue ? "toggle-off" : "toggle-on"}`, next);
        },
        [scheduleHoverPrefetch]
    );

    const prefetchSubcategoryHover = useCallback(
        (value: string) => {
            const cur = filtersRef.current;
            const raw = typeof cur.subcategories === "string" ? cur.subcategories : "";
            const current = raw.split(",").filter(Boolean)[0];
            const next: Filters = { ...cur, page: 1 };
            if (current === value) {
                delete next.subcategories;
            } else {
                next.subcategories = value;
            }
            scheduleHoverPrefetch(`sub:${value}:${current === value ? "toggle-off" : "toggle-on"}`, next);
        },
        [scheduleHoverPrefetch]
    );

    const prefetchPageHover = useCallback(
        (page: number) => {
            if (page < 1) return;
            scheduleHoverPrefetch(`page:${page}`, { ...filtersRef.current, page });
        },
        [scheduleHoverPrefetch]
    );

    const prefetchBrandHover = useCallback(
        (brandSlug: string) => {
            const cur = filtersRef.current;
            const brandStr = typeof cur.brand === "string" ? cur.brand : "";
            const current = brandStr ? brandStr.split(",").filter(Boolean) : [];
            const next: Filters = { ...cur, page: 1 };
            if (current.includes(brandSlug)) {
                const remaining = current.filter((b) => b !== brandSlug);
                if (remaining.length > 0) next.brand = remaining.join(",");
                else delete next.brand;
            } else {
                next.brand = [...current, brandSlug].join(",");
            }
            scheduleHoverPrefetch(
                `brand:${brandSlug}:${current.includes(brandSlug) ? "off" : "on"}`,
                next
            );
        },
        [scheduleHoverPrefetch]
    );

    const prefetchSpecHover = useCallback(
        (key: string, value: string) => {
            const cur = filtersRef.current;
            const currentSpec = cur.spec ?? {};
            const currentVals =
                currentSpec[key]
                    ? (currentSpec[key] as string).split(",").filter(Boolean)
                    : [];
            const next: Filters = { ...cur, page: 1 };
            const newSpec = { ...currentSpec };
            if (currentVals.includes(value)) {
                const remaining = currentVals.filter((v) => v !== value);
                if (remaining.length > 0) newSpec[key] = remaining.join(",");
                else delete newSpec[key];
            } else {
                newSpec[key] = [...currentVals, value].join(",");
            }
            if (Object.keys(newSpec).length > 0) next.spec = newSpec;
            else delete next.spec;
            scheduleHoverPrefetch(
                `spec:${key}:${value}:${currentVals.includes(value) ? "off" : "on"}`,
                next
            );
        },
        [scheduleHoverPrefetch]
    );

    // Warm all four sort variants when the user mouses over the sort control.
    // Each sort is individually checked against the React Query cache first; if that
    // exact query is already fresh, no network request is made.
    const prefetchSortHover = useCallback(() => {
        const cur = filtersRef.current;
        const sorts = ["newest", "price-asc", "price-desc", "name-asc"] as const;
        for (const sort of sorts) {
            if (sort === cur.sort) continue;
            const opts = getProductsQueryOptions({
                ...cur,
                sort,
                page: 1,
                limit: SHOP_PRODUCTS_PER_PAGE,
                includeFacets: false,
            });
            const state = queryClient.getQueryState(opts.queryKey);
            const isFresh =
                state?.dataUpdatedAt != null &&
                Date.now() - state.dataUpdatedAt < SHOP_LIST_STALE_MS;
            if (!isFresh) {
                void prefetchShopListState({ ...cur, sort, page: 1 });
            }
        }
    }, [queryClient, prefetchShopListState]);

    useEffect(() => {
        filtersRef.current = filters;
    }, [filters]);

    // Fetch products first (fast path without expensive facets aggregation)
    const {
        data,
        isLoading,
        isFetching,
        isPlaceholderData,
        error,
        refetch: refetchProducts,
    } = useProducts({
        ...filters,
        limit: SHOP_PRODUCTS_PER_PAGE,
        includeFacets: false,
    });
    // Facets are hydrated from SSR on first load; this query keeps them in sync
    // as filters change. Options come from `shopFacetsOptions` so the cache key
    // matches the server prefetch and the hover prefetch.
    const facetsOptions = useMemo(() => shopFacetsOptions(filters), [filters]);
    const {
        data: facetsData,
        isLoading: isFacetsLoading,
        isFetching: isFacetsFetching,
        refetch: refetchFacets,
    } = useProductFacets(facetsOptions);
    const products = data?.products || [];
    const listingKey = JSON.stringify(filters);
    const prevListingKeyRef = useRef(listingKey);
    const [productsRefreshing, setProductsRefreshing] = useState(false);

    useEffect(() => {
        if (prevListingKeyRef.current === listingKey) return;
        prevListingKeyRef.current = listingKey;
        setProductsRefreshing(true);
    }, [listingKey]);

    useEffect(() => {
        if (!productsRefreshing) return;
        if (isFetching) return;
        const timer = setTimeout(() => setProductsRefreshing(false), PRODUCTS_REFRESH_MIN_MS);
        return () => clearTimeout(timer);
    }, [productsRefreshing, isFetching]);

    const showProductsOverlay =
        products.length > 0 && (productsRefreshing || isFetching || isPlaceholderData);

    // Warm the first visible product pages in the background, even without hover:
    // 1) Next.js route/RSC payload cache via router.prefetch
    // 2) React Query product detail cache via prefetchQuery
    useEffect(() => {
        if (products.length === 0 || typeof window === "undefined") return;

        const warmTopProducts = () => {
            for (const product of products.slice(0, SHOP_AUTO_WARM_LIMIT)) {
                const slug = product.slug || product._id;
                if (!slug || warmedProductRoutesRef.current.has(slug)) continue;

                warmedProductRoutesRef.current.add(slug);
                router.prefetch(`/product/${slug}`);

                const queryKey = ["product", slug] as const;
                const state = queryClient.getQueryState(queryKey);
                const isFresh =
                    state?.dataUpdatedAt != null &&
                    Date.now() - state.dataUpdatedAt < PRODUCT_DETAIL_STALE_MS;
                if (!isFresh) {
                    void queryClient.prefetchQuery({
                        queryKey,
                        queryFn: async () => {
                            const { data } = await api.get(`/products/${slug}`);
                            return data;
                        },
                        staleTime: PRODUCT_DETAIL_STALE_MS,
                    });
                }
            }
        };

        if (typeof globalThis.requestIdleCallback === "function") {
            const idleId = globalThis.requestIdleCallback(warmTopProducts, { timeout: 1500 });
            return () => globalThis.cancelIdleCallback?.(idleId);
        }

        const timeoutId = globalThis.setTimeout(warmTopProducts, 200);
        return () => globalThis.clearTimeout(timeoutId);
    }, [products, queryClient, router]);

    useEffect(() => {
        if (products.length === 0) {
            setVisibleProductsCount(0);
            return;
        }
        const initialCount = Math.min(INITIAL_VISIBLE_PRODUCTS, products.length);
        setVisibleProductsCount(initialCount);
        if (products.length <= initialCount) return;

        const timer = window.setInterval(() => {
            setVisibleProductsCount((prev) => {
                if (prev >= products.length) return prev;
                return Math.min(prev + PRODUCT_REVEAL_BATCH_SIZE, products.length);
            });
        }, PRODUCT_REVEAL_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [products]);

    useEffect(() => {
        // After first reveal, never hide filters again during refetches.
        if (hasShownFiltersRef.current) {
            if (!showFiltersPanel) setShowFiltersPanel(true);
            return;
        }
        if (isFacetsLoading || (isFacetsFetching && !facetsData)) return;
        const timer = window.setTimeout(() => setShowFiltersPanel(true), FILTERS_REVEAL_DELAY_MS);
        return () =>
            window.clearTimeout(timer);
    }, [isFacetsLoading, isFacetsFetching, facetsData, showFiltersPanel]);

    /**
     * Facets hydrated from SSR are present on the very first render, so the sidebar
     * ships visible in the HTML — no reveal timer, no fade-in. The effect above only
     * still matters when the SSR prefetch missed its budget and the client fetches.
     */
    const hasFacetData = Boolean(facetsData);

    useEffect(() => {
        if (!showFiltersPanel) return;
        hasShownFiltersRef.current = true;
    }, [showFiltersPanel]);

    const facets = useMemo(() => {
        const fd = facetsData as { facets?: Facets; featuredSpecKeys?: string[] } | undefined;
        return {
            ...(fd?.facets ?? {}),
            featuredSpecKeys: Array.isArray(fd?.featuredSpecKeys) ? fd.featuredSpecKeys : [],
        };
    }, [facetsData]);

    // Track previous category to detect changes
    const prevCategoryRef = useRef(filters.category);
    const hasMountedRef = useRef(false);
    const prevNonPageFiltersRef = useRef<string>("");

    // Reset specs and brands when category changes
    useEffect(() => {
        if (prevCategoryRef.current !== filters.category) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- derived reset when department changes
            setFilters((prev) => {
                const next = { ...prev, page: 1 };
                delete next.spec;
                delete next.brand;
                delete next.subcategories;
                return next;
            });
            prevCategoryRef.current = filters.category;
        }
    }, [filters.category]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const next = serializeShopListingUrl(filtersRef.current, window.location.href);
        const cur = `${window.location.pathname}${window.location.search}`;
        if (shopListingUrlsEquivalent(cur, next)) return;
        // Shallow URL sync (supported by Next 14.1+): updates the address bar and
        // useSearchParams without an App Router navigation. router.replace() here
        // re-rendered the dynamic page on the server for every filter click, which
        // re-triggered the Suspense fallback and made the filter sidebar vanish.
        window.history.replaceState(window.history.state, "", next);
    }, [filters]);

    useEffect(() => {
        const nonPageFilters = { ...filters };
        delete nonPageFilters.page;
        const serialized = JSON.stringify(nonPageFilters);

        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            prevNonPageFiltersRef.current = serialized;
            return;
        }

        if (prevNonPageFiltersRef.current !== serialized) {
            productsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }

        prevNonPageFiltersRef.current = serialized;
    }, [filters]);

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
            // eslint-disable-next-line react-hooks/set-state-in-effect -- drop spec keys no longer in facet response
            setFilters((prev: Filters) => {
                const next = { ...prev, page: 1 };
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
        setFilters((prev: Filters) => ({
            search: prev.search,
            sort: prev.sort,
            page: 1,
        }));
    };

    const commitSearch = useCallback((raw: string) => {
        const q = raw.trim();
        const next = { ...filtersRef.current, search: q, page: 1 };
        setFilters(next);
    }, []);

    const flushSearchDebounce = useCallback(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
            searchDebounceRef.current = null;
        }
    }, []);

    useEffect(() => () => flushSearchDebounce(), [flushSearchDebounce]);
    useEffect(
        () => () => {
            if (hoverPrefetchTimerRef.current) clearTimeout(hoverPrefetchTimerRef.current);
        },
        []
    );

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

    const goToPage = (page: number) => {
        setFilters((prev: Filters) => ({ ...prev, page }));
        if (typeof window !== "undefined") {
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const pagination = (data as { pagination?: { page: number; pages: number; total: number } })?.pagination;
    const currentPage = pagination?.page ?? (data as { page?: number })?.page ?? 1;
    const totalPages = pagination?.pages ?? (data as { pages?: number })?.pages ?? 1;
    const totalProducts = pagination?.total ?? (data as { total?: number })?.total;
    const showPagination = totalPages > 1 && !isLoading && !error;

    // A `page` left over from a wider result set (bookmarked/shared URL, or a
    // product removed since) can point past the last page. The response still
    // reports the real total, so the header reads "N products" over an empty
    // grid. Snap back to the last real page once the count is known.
    useEffect(() => {
        if (isLoading || isPlaceholderData || !data) return;
        const requestedPage = typeof filters.page === "number" ? filters.page : 1;
        if (requestedPage > 1 && requestedPage > totalPages) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp a stale page to the last real one
            setFilters((prev: Filters) => ({ ...prev, page: Math.max(totalPages, 1) }));
        }
    }, [data, isLoading, isPlaceholderData, filters.page, totalPages, setFilters]);

    const shopProductCardProps = {
        showWhatsAppButton: false,
        showOrderNowButton: true,
        onNavigateToProduct: rememberCurrentShopState,
    } as const;
    const visibleProducts = products.slice(0, Math.min(visibleProductsCount, products.length));
    const shouldShowFiltersPanel = showFiltersPanel || isSidebarOpen || hasFacetData;

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
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8E8E8E]">Catalog</p>
                        {heading && (
                            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#F1F1F1]">{heading}</h1>
                        )}
                        {subheading && (
                            <p className="max-w-2xl text-sm font-medium leading-relaxed text-[#B0B0B0] sm:text-base">
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

                <div className="relative lg:shrink-0">
                    {/* Shown only when the SSR facet prefetch missed its budget, so the
                        column reads as "loading" instead of silently absent. The real
                        sidebar stays mounted underneath (it owns the mobile drawer), and
                        the skeleton holds the same 17rem column width — no layout shift
                        when facets land. */}
                    {!shouldShowFiltersPanel && <FilterSidebarSkeleton />}

                    <div
                        className={
                            shouldShowFiltersPanel
                                ? "transition-opacity duration-300 opacity-100"
                                : "pointer-events-none absolute inset-0 opacity-0"
                        }
                        aria-hidden={!shouldShowFiltersPanel}
                    >
                        <DynamicFilterSidebar
                            facets={facets}
                            filters={filters}
                            setFilters={setFilters}
                            isOpen={isSidebarOpen}
                            onClose={() => setIsSidebarOpen(false)}
                            onCategoryPrefetchEnter={prefetchCategoryHover}
                            onSubcategoryPrefetchEnter={prefetchSubcategoryHover}
                            onBrandPrefetchEnter={prefetchBrandHover}
                            onSpecPrefetchEnter={prefetchSpecHover}
                        />
                    </div>
                </div>

                <div ref={productsTopRef} className="flex-1 min-w-0 space-y-6">
                    <div className="sticky top-[6.25rem] z-20 -mx-1 px-1 py-3 sm:static sm:z-0 sm:mx-0 sm:px-0 sm:py-0 bg-gradient-to-b from-[#121212] via-[#121212] to-transparent sm:bg-none">
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
                                {showProductsOverlay && !isLoading && (
                                    <div className="inline-flex items-center gap-2 rounded-full border border-[#D12B28]/30 bg-[#D12B28]/10 px-2.5 py-1 text-xs text-[#F4C5C5]">
                                        <Loader2 className="h-3 w-3 animate-spin text-[#D12B28]" aria-hidden />
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
                                    onMouseEnter={prefetchSortHover}
                                    onFocus={prefetchSortHover}
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
                            {Array.from({ length: SHOP_PRODUCTS_PER_PAGE }).map((_, i) => (
                                <ProductCardSkeleton key={`shop-skeleton-${i}`} />
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
                                    {visibleProducts.map((product) => (
                                        <ProductCard
                                            key={product._id}
                                            product={product}
                                            {...shopProductCardProps}
                                        />
                                    ))}
                                </div>
                                {showProductsOverlay && (
                                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[#121212]/70 backdrop-blur-sm">
                                        <LoadingAnimation size="md" label="Updating products..." />
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
                                            onPointerEnter={
                                                currentPage > 1
                                                    ? () => prefetchPageHover(currentPage - 1)
                                                    : undefined
                                            }
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
                                                        onPointerEnter={
                                                            p !== currentPage
                                                                ? () => prefetchPageHover(p as number)
                                                                : undefined
                                                        }
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
                                            onPointerEnter={
                                                currentPage < totalPages
                                                    ? () => prefetchPageHover(currentPage + 1)
                                                    : undefined
                                            }
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

function FilterSidebarSkeleton() {
    return (
        <div
            className="hidden animate-pulse lg:block lg:w-[17rem] lg:shrink-0 lg:self-start lg:rounded-2xl lg:border lg:border-white/[0.08] lg:bg-zinc-900/50"
            aria-hidden
        >
            <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3.5">
                <div className="h-7 w-7 rounded-lg bg-zinc-800" />
                <div className="h-4 w-16 rounded-full bg-zinc-800" />
            </div>
            <div className="space-y-6 px-4 py-5">
                {[...Array(4)].map((_, section) => (
                    <div key={section} className="space-y-3">
                        <div className="h-3.5 w-24 rounded-full bg-zinc-800" />
                        {[...Array(4)].map((_, row) => (
                            <div key={row} className="flex items-center gap-2.5">
                                <div className="h-4 w-4 shrink-0 rounded bg-zinc-800/70" />
                                <div className="h-3 flex-1 rounded-full bg-zinc-800/50" />
                            </div>
                        ))}
                    </div>
                ))}
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

function ProductCardSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-[#5E5E5E]/30 bg-[#1b1b1b]/70 animate-pulse">
            <div className="aspect-square bg-[#2a2a2a]" />
            <div className="space-y-3 p-4">
                <div className="h-3 w-1/3 rounded-full bg-[#343434]" />
                <div className="h-4 w-full rounded-full bg-[#343434]" />
                <div className="h-4 w-2/3 rounded-full bg-[#343434]" />
                <div className="pt-2 flex items-center justify-between">
                    <div className="h-5 w-20 rounded-full bg-[#343434]" />
                    <div className="h-8 w-24 rounded-xl bg-[#343434]" />
                </div>
            </div>
        </div>
    );
}
