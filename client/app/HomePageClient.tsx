"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    ChevronLeft,
    ChevronRight,
    Cpu,
    LifeBuoy,
    Search,
    ShieldCheck,
    Truck,
    X,
} from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import PromotionStripe from "@/components/PromotionStripe";
import FlowSectionHeader from "@/components/FlowSectionHeader";
import HomeFaqSection from "@/components/HomeFaqSection";
import api from "@/lib/api";
import LoadingAnimation from "@/components/LoadingAnimation";
import { HOME_FEATURED_PRODUCTS_OPTIONS } from "@/lib/homeFeaturedProductsQuery";
import { HOME_DISCOUNTED_PRODUCTS_OPTIONS } from "@/lib/homeDiscountedProductsQuery";
import { useHomePartners } from "@/lib/homePartnersQuery";
import { useHomeSettings } from "@/lib/homeSettingsQuery";

const DeferredShopReviewsStrip = dynamic(() => import("@/components/ShopReviewsStrip"), {
    ssr: false,
    loading: () => <div className="h-32 rounded-xl border border-white/[0.06] bg-white/[0.02]" />,
});
const DeferredReviewForm = dynamic(() => import("@/components/reviews/ReviewForm"), {
    ssr: false,
    loading: () => <div className="h-28 rounded-xl border border-white/[0.06] bg-white/[0.02]" />,
});

const SEARCH_PREVIEW_DEBOUNCE_MS = 320;
/** Featured strip: fetch more than the old 4-up grid; slider steps through them product-by-product. */
/** Time between automatic slide steps (ms). */
const FEATURED_AUTO_SCROLL_MS = 4500;
/** Per-step transform duration (ms). */
const FEATURED_SLIDE_TRANSITION_MS = 520;
/** Render extra copies so we can recenter off-screen and keep the loop feeling continuous. */
const FEATURED_LOOP_COPIES = 5;
const DISCOUNTED_ROW_LIMIT = 16;
const PROMOTIONS_STALE_MS = 20 * 60 * 1000;
const PROMOTIONS_CACHE_KEY = "home:promotions:active:v2";

/**
 * Appends an optional cache-busting query string to partner logo URLs.
 */
function withLogoCacheBust(path: string): string {
    const v = process.env.NEXT_PUBLIC_LOGO_ASSET_VERSION?.trim();
    return v ? `${path}?v=${encodeURIComponent(v)}` : path;
}

export default function Home() {
    type Promotion = {
        _id: string;
        title: string;
        description: string;
        imageUrl: string;
        link: string;
        badgeText: string;
        validFrom: string;
        validTo: string;
        directRedirect?: boolean;
    };

    const readCachedPromotions = (): { data: Promotion[]; updatedAt: number } | null => {
        if (typeof window === "undefined") return null;
        try {
            const raw = window.sessionStorage.getItem(PROMOTIONS_CACHE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { data?: Promotion[]; updatedAt?: number };
            if (!Array.isArray(parsed?.data) || typeof parsed?.updatedAt !== "number") return null;
            return { data: parsed.data, updatedAt: parsed.updatedAt };
        } catch {
            return null;
        }
    };
    const cachedPromotions = readCachedPromotions();

    const { data: promotions = [], isPending: loadingPromotions } = useQuery({
        queryKey: ["promotions", "active"] as const,
        queryFn: async (): Promise<Promotion[]> => {
            try {
                const res = await api.get<Promotion[]>("/promotions/active");
                return Array.isArray(res.data) ? res.data : [];
            } catch {
                return [];
            }
        },
        initialData: cachedPromotions?.data,
        initialDataUpdatedAt: cachedPromotions?.updatedAt,
        staleTime: PROMOTIONS_STALE_MS,
    });
    useEffect(() => {
        if (typeof window === "undefined" || promotions.length === 0) return;
        try {
            window.sessionStorage.setItem(
                PROMOTIONS_CACHE_KEY,
                JSON.stringify({ data: promotions, updatedAt: Date.now() })
            );
        } catch {
            // Ignore storage quota/private mode errors.
        }
    }, [promotions]);

    const router = useRouter();
    const [searchDraft, setSearchDraft] = useState("");
    const [previewQuery, setPreviewQuery] = useState("");

    const { data: topBrands = [] } = useHomePartners();

    const { data: featuredData, isLoading: loadingFeatured } = useProducts({
        ...HOME_FEATURED_PRODUCTS_OPTIONS,
    });
    const { data: discountedData, isLoading: loadingDiscounted } = useProducts({
        ...HOME_DISCOUNTED_PRODUCTS_OPTIONS,
    });
    const { data: homeSettings } = useHomeSettings();
    const showDiscountedProductsRow = homeSettings?.showDiscountedProductsRow ?? true;
    const featuredProducts = featuredData?.products || [];
    const discountedProducts = (discountedData?.products || [])
        .filter((product) => (product.effectiveDiscountPercent ?? 0) > 0)
        .slice(0, DISCOUNTED_ROW_LIMIT);
    const baseFeaturedCount = featuredProducts.length;
    const featuredLoopedProducts = baseFeaturedCount > 1
        ? Array.from({ length: FEATURED_LOOP_COPIES }, (_, copyIdx) =>
            featuredProducts.map((product) => ({ product, copyIdx }))
        ).flat()
        : featuredProducts.map((product) => ({ product, copyIdx: 0 }));

    const featuredTrackRef = useRef<HTMLDivElement>(null);
    const featuredIndexRef = useRef(0);
    const [featuredOffset, setFeaturedOffset] = useState(0);
    const [featuredAnimate, setFeaturedAnimate] = useState(false);

    const readOffset = useCallback((index: number): number => {
        const track = featuredTrackRef.current;
        if (!track) return 0;
        const items = track.querySelectorAll<HTMLElement>("[data-featured-slider-item]");
        return items[index]?.offsetLeft ?? 0;
    }, []);

    const jumpTo = useCallback((index: number) => {
        featuredIndexRef.current = index;
        setFeaturedAnimate(false);
        requestAnimationFrame(() => {
            setFeaturedOffset(readOffset(index));
            // Re-enable transitions on the following frame so recentering never animates backward.
            requestAnimationFrame(() => {
                setFeaturedAnimate(true);
            });
        });
    }, [readOffset]);

    const slideTo = useCallback((index: number) => {
        featuredIndexRef.current = index;
        requestAnimationFrame(() => {
            setFeaturedOffset(readOffset(index));
        });
    }, [readOffset]);

    // On load: jump silently to the first item of the center copy.
    useEffect(() => {
        if (baseFeaturedCount <= 1) {
            featuredIndexRef.current = 0;
            setFeaturedOffset(0);
            setFeaturedAnimate(false);
            return;
        }
        jumpTo(baseFeaturedCount * 2);
    }, [baseFeaturedCount, jumpTo]);

    // Re-measure on resize so offsets stay accurate.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            setFeaturedOffset(readOffset(featuredIndexRef.current));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [readOffset]);

    // Auto-advance every interval.
    useEffect(() => {
        if (baseFeaturedCount <= 1) return;
        if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const intervalId = window.setInterval(() => {
            slideTo(featuredIndexRef.current + 1);
        }, FEATURED_AUTO_SCROLL_MS);
        return () => window.clearInterval(intervalId);
    }, [baseFeaturedCount, loadingFeatured, slideTo]);

    // After each animated step: silently recenter into the center copy.
    const handleFeaturedTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
        if (event.propertyName !== "transform") return;
        if (baseFeaturedCount <= 1) return;
        const current = featuredIndexRef.current;
        const minIdx = baseFeaturedCount * 2;
        const maxIdx = baseFeaturedCount * 3 - 1;
        if (current >= minIdx && current <= maxIdx) return;
        const recentered = current > maxIdx
            ? current - baseFeaturedCount
            : current + baseFeaturedCount;
        jumpTo(recentered);
    }, [baseFeaturedCount, jumpTo]);

    const handleFeaturedArrow = useCallback((direction: 1 | -1) => {
        if (baseFeaturedCount <= 1) return;
        slideTo(featuredIndexRef.current + direction);
    }, [baseFeaturedCount, slideTo]);

    const baseDiscountedCount = discountedProducts.length;
    const discountedLoopedProducts = baseDiscountedCount > 1
        ? Array.from({ length: FEATURED_LOOP_COPIES }, (_, copyIdx) =>
            discountedProducts.map((product) => ({ product, copyIdx }))
        ).flat()
        : discountedProducts.map((product) => ({ product, copyIdx: 0 }));

    const discountedTrackRef = useRef<HTMLDivElement>(null);
    const discountedIndexRef = useRef(0);
    const [discountedOffset, setDiscountedOffset] = useState(0);
    const [discountedAnimate, setDiscountedAnimate] = useState(false);

    const readDiscountedOffset = useCallback((index: number): number => {
        const track = discountedTrackRef.current;
        if (!track) return 0;
        const items = track.querySelectorAll<HTMLElement>("[data-discounted-slider-item]");
        return items[index]?.offsetLeft ?? 0;
    }, []);

    const jumpDiscountedTo = useCallback((index: number) => {
        discountedIndexRef.current = index;
        setDiscountedAnimate(false);
        requestAnimationFrame(() => {
            setDiscountedOffset(readDiscountedOffset(index));
            requestAnimationFrame(() => {
                setDiscountedAnimate(true);
            });
        });
    }, [readDiscountedOffset]);

    const slideDiscountedTo = useCallback((index: number) => {
        discountedIndexRef.current = index;
        requestAnimationFrame(() => {
            setDiscountedOffset(readDiscountedOffset(index));
        });
    }, [readDiscountedOffset]);

    useEffect(() => {
        if (baseDiscountedCount <= 1) {
            discountedIndexRef.current = 0;
            setDiscountedOffset(0);
            setDiscountedAnimate(false);
            return;
        }
        jumpDiscountedTo(baseDiscountedCount * 2);
    }, [baseDiscountedCount, jumpDiscountedTo]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleResize = () => {
            setDiscountedOffset(readDiscountedOffset(discountedIndexRef.current));
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [readDiscountedOffset]);

    useEffect(() => {
        if (baseDiscountedCount <= 1) return;
        if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const intervalId = window.setInterval(() => {
            slideDiscountedTo(discountedIndexRef.current + 1);
        }, FEATURED_AUTO_SCROLL_MS);
        return () => window.clearInterval(intervalId);
    }, [baseDiscountedCount, loadingDiscounted, slideDiscountedTo]);

    const handleDiscountedTransitionEnd = useCallback((event: React.TransitionEvent<HTMLDivElement>) => {
        if (event.propertyName !== "transform") return;
        if (baseDiscountedCount <= 1) return;
        const current = discountedIndexRef.current;
        const minIdx = baseDiscountedCount * 2;
        const maxIdx = baseDiscountedCount * 3 - 1;
        if (current >= minIdx && current <= maxIdx) return;
        const recentered = current > maxIdx
            ? current - baseDiscountedCount
            : current + baseDiscountedCount;
        jumpDiscountedTo(recentered);
    }, [baseDiscountedCount, jumpDiscountedTo]);

    const handleDiscountedArrow = useCallback((direction: 1 | -1) => {
        if (baseDiscountedCount <= 1) return;
        slideDiscountedTo(discountedIndexRef.current + direction);
    }, [baseDiscountedCount, slideDiscountedTo]);

    const normalizedPreviewQuery = previewQuery.trim();
    const shouldShowPreview = normalizedPreviewQuery.length > 0;
    const { data: previewData, isFetching: loadingPreview } = useProducts({
        search: shouldShowPreview ? normalizedPreviewQuery : undefined,
        limit: 4,
        sort: "newest",
        enabled: shouldShowPreview,
    });
    const previewProducts = shouldShowPreview ? (previewData?.products || []).slice(0, 4) : [];

    useEffect(() => {
        const timer = setTimeout(() => {
            setPreviewQuery(searchDraft);
        }, SEARCH_PREVIEW_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchDraft]);

    const clearSearch = () => {
        setSearchDraft("");
        setPreviewQuery("");
    };

    const runFullSearch = () => {
        const q = searchDraft.trim();
        if (q) {
            router.push(`/shop?search=${encodeURIComponent(q)}`);
        }
    };
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        runFullSearch();
    };

    useEffect(() => {
        if (loadingFeatured) return;
        void router.prefetch("/shop");
    }, [loadingFeatured, router]);

    /**
     * `slug` must match each category’s `slug` in Admin → Categories (lowercase recommended).
     */
    const categories = [
        {
            label: "RAM",
            slug: "ram",
            imageSrc: "https://res.cloudinary.com/dwuxumj4x/image/upload/v1780935432/RAM_ctehfc.png",
            imageClassName: "h-[8.3rem] w-[8.3rem] right-[0.65rem] top-[53%] -translate-y-1/2 rotate-[8deg] group-hover:right-[-0.6rem] group-hover:-translate-y-[62%] group-hover:scale-[1.2]",
        },
        {
            label: "Mouse",
            slug: "mouse",
            imageSrc: "https://res.cloudinary.com/dwuxumj4x/image/upload/v1780935432/mouse_daykjh.png",
            imageClassName: "h-[6rem] w-[6rem] right-[0.7rem] top-[53%] -translate-y-1/2 -rotate-[6deg] group-hover:right-[-0.55rem] group-hover:-translate-y-[62%] group-hover:scale-[1.2]",
        },
        {
            label: "Storage",
            slug: "storage",
            imageSrc: "https://res.cloudinary.com/dwuxumj4x/image/upload/v1780935437/ssd_wzn40f.png",
            imageClassName: "h-[6.1rem] w-[6.1rem] right-[0.65rem] top-[53%] -translate-y-1/2 rotate-[3deg] group-hover:right-[-0.6rem] group-hover:-translate-y-[62%] group-hover:scale-[1.2]",
        },
        {
            label: "Headset",
            slug: "headset",
            imageSrc: "https://res.cloudinary.com/dwuxumj4x/image/upload/v1780935433/head_ttd2l2.png",
            imageClassName: "h-[6.15rem] w-[6.15rem] right-[0.65rem] top-[53%] -translate-y-1/2 -rotate-[9deg] group-hover:right-[-0.6rem] group-hover:-translate-y-[62%] group-hover:scale-[1.2]",
        },
    ];

    const servicePillars = [
        {
            title: "Carefully Selected Hardware",
            description: "Parts and peripherals from brands trusted by gamers, creators, and PC enthusiasts.",
            icon: ShieldCheck
        },
        {
            title: "Reliable Islandwide Delivery",
            description: "Secure packaging and fast fulfillment to keep sensitive components protected during transit.",
            icon: Truck
        },
        {
            title: "Real Build Assistance",
            description: "Get practical recommendations for balanced gaming, editing, streaming, or productivity setups.",
            icon: Cpu
        },
        {
            title: "Support Beyond Checkout",
            description: "Need help with compatibility, upgrades, or troubleshooting? We’re here before and after the purchase.",
            icon: LifeBuoy
        }
    ];

    return (
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] pb-[env(safe-area-inset-bottom,0px)] text-[#F1F1F1]">
            <PromotionStripe asHero promotions={promotions} loading={loadingPromotions} />

            {/* One continuous storefront canvas — gradient ties sections together */}
            <div className="relative flex flex-col bg-[linear-gradient(180deg,#080808_0%,#0c0c0c_18%,#101010_45%,#0d0d0d_72%,#0a0a0a_100%)] pb-5 sm:pb-8">
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -right-40 top-[28%] h-[min(80vw,28rem)] w-[min(80vw,28rem)] rounded-full bg-[#D12B28]/[0.04] blur-[100px]"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -left-32 top-[62%] h-72 w-72 rounded-full bg-[#D12B28]/[0.035] blur-[90px]"
                    aria-hidden
                />

                {/* Search & categories — single “discover” chapter */}
                <section className="relative pt-4 sm:pt-8 lg:pt-10">
                    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c0c]/90 shadow-[0_28px_90px_rgba(0,0,0,0.5)] backdrop-blur-sm sm:rounded-[1.75rem]">

                            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_5%,rgba(209,43,40,0.65)_50%,transparent_95%)]" />
                            <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-[#D12B28]/10 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#D12B28]/6 blur-3xl" />

                            <div className="relative grid gap-6 p-4 sm:gap-8 sm:p-7 lg:grid-cols-[1fr_minmax(0,0.95fr)] lg:items-start lg:gap-10 lg:p-10">
                                <div className="relative min-w-0">
                                    <FlowSectionHeader
                                        watermark="SHOP"
                                        eyebrow="Discover"
                                        title="Find the parts your build is missing"
                                        description="Upgrade smarter. Search by product, category, or jump straight into what’s trending."
                                    />
                                    <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#D12B28] shadow-[0_0_6px_#D12B28]" />
                                            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D12B28]/80 sm:text-[11px] sm:tracking-[0.22em]">
                                                Explore Products
                                            </span>
                                        </div>
                                        <div className="flex w-full gap-2 sm:w-auto sm:flex-wrap sm:items-center">
                                            <Link
                                                href="/shop"
                                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#D12B28] px-3 py-2 text-xs font-semibold text-white shadow-[0_0_14px_rgba(209,43,40,0.4)] transition hover:bg-[#E53A36] sm:flex-none sm:px-3.5 sm:py-1.5"
                                            >
                                                Shop All <ArrowRight className="h-3.5 w-3.5" />
                                            </Link>
                                            <Link
                                                href="/services"
                                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80 transition hover:border-[#D12B28]/40 hover:text-white sm:flex-none sm:px-3.5 sm:py-1.5"
                                            >
                                                Build Help - Get Build Advice
                                            </Link>
                                        </div>
                                    </div>

                                    {/* Search bar — matches shop page behaviour */}
                                    <form id="home-search-form" role="search" onSubmit={handleSearchSubmit} className="relative">
                                        <label className="sr-only" htmlFor="home-search">Search products</label>
                                        <div className="group relative flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#161616] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] focus-within:border-[#D12B28]/60 focus-within:shadow-[0_0_0_3px_rgba(209,43,40,0.18),inset_0_1px_0_rgba(255,255,255,0.05)] sm:flex-row sm:items-center sm:gap-3 sm:p-2.5 sm:py-2.5 sm:pl-4">
                                            <div className="flex min-h-[2.75rem] flex-1 items-center gap-2.5 sm:min-h-0 sm:gap-3">
                                                <Search
                                                    className="pointer-events-none h-5 w-5 shrink-0 text-[#555] transition-colors group-focus-within:text-[#D12B28]"
                                                    aria-hidden
                                                />
                                                <input
                                                    id="home-search"
                                                    type="text"
                                                    name="q"
                                                    enterKeyHint="search"
                                                    autoComplete="off"
                                                    autoCorrect="off"
                                                    spellCheck={false}
                                                    placeholder="Search GPUs, RAM, SSDs…"
                                                    value={searchDraft}
                                                    onChange={(e) => setSearchDraft(e.target.value)}
                                                    className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[16px] text-[#F1F1F1] caret-[#D12B28] placeholder:text-[#555] focus:outline-none focus:ring-0 sm:text-base sm:placeholder:text-[#444]"
                                                />
                                                {searchDraft && (
                                                    <button
                                                        type="button"
                                                        onClick={clearSearch}
                                                        aria-label="Clear search"
                                                        className="shrink-0 rounded-lg p-2 text-[#555] transition hover:bg-white/10 hover:text-[#F1F1F1] sm:p-1.5"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                type="submit"
                                                className="w-full shrink-0 rounded-xl bg-[#D12B28] py-2.5 text-sm font-bold text-white shadow-[0_0_16px_rgba(209,43,40,0.35)] transition hover:bg-[#E53A36] hover:shadow-[0_0_24px_rgba(209,43,40,0.5)] sm:w-auto sm:px-5 sm:py-2"
                                            >
                                                Search
                                            </button>
                                        </div>

                                        {shouldShowPreview && (
                                            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 overflow-hidden rounded-xl border border-white/[0.08] bg-[#131313] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
                                                {loadingPreview ? (
                                                    <div className="space-y-2 p-3">
                                                        {[...Array(4)].map((_, idx) => (
                                                            <div key={idx} className="h-16 animate-pulse rounded-lg border border-white/8 bg-white/[0.03]" />
                                                        ))}
                                                    </div>
                                                ) : previewProducts.length === 0 ? (
                                                    <div className="p-4 text-sm text-[#8E8E8E]">No matching products found.</div>
                                                ) : (
                                                    <>
                                                        <ul className="max-h-80 overflow-y-auto p-2">
                                                            {previewProducts.map((product) => {
                                                                const productPath = `/product/${product.slug || product._id}`;
                                                                const brandLabel = typeof product.brand === "object" && product.brand !== null
                                                                    ? product.brand.name
                                                                    : product.brand;
                                                                const effectiveDiscountAmount = product.effectiveDiscountPercent ?? product.discountPercent ?? null;
                                                                const originalPrice = product.originalPrice ?? product.price;
                                                                const discountedPrice = product.discountedPrice ?? product.price;

                                                                return (
                                                                    <li key={product._id}>
                                                                        <Link
                                                                            href={productPath}
                                                                            className="group flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/[0.06]"
                                                                        >
                                                                            <Image
                                                                                src={product.images?.[0] || "/placeholder.svg"}
                                                                                alt={product.title}
                                                                                width={48}
                                                                                height={48}
                                                                                sizes="48px"
                                                                                quality={65}
                                                                                className="h-12 w-12 rounded-md object-cover"
                                                                            />
                                                                            <div className="min-w-0">
                                                                                <p className="truncate text-[11px] text-[#8E8E8E]">{brandLabel}</p>
                                                                                <p className="line-clamp-1 text-sm font-semibold text-[#F1F1F1]">{product.title}</p>
                                                                                {effectiveDiscountAmount != null && effectiveDiscountAmount > 0 ? (
                                                                                    <p className="mt-0.5 text-xs font-semibold text-[#D12B28] flex items-baseline gap-2">
                                                                                        <span className="text-[#8E8E8E] line-through font-semibold text-[11px]">
                                                                                            LKR {originalPrice.toLocaleString()}
                                                                                        </span>
                                                                                        <span>LKR {discountedPrice.toLocaleString()}</span>
                                                                                        <span className="text-[10px] text-[#F4C5C5] font-bold">Save LKR {Math.round(effectiveDiscountAmount).toLocaleString()}</span>
                                                                                    </p>
                                                                                ) : (
                                                                                    <p className="mt-0.5 text-xs font-semibold text-[#D12B28]">
                                                                                        LKR {product.price.toLocaleString()}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </Link>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                        <button
                                                            type="button"
                                                            onClick={runFullSearch}
                                                            className="w-full border-t border-white/[0.06] px-4 py-2.5 text-sm font-semibold text-[#D12B28] transition hover:bg-white/[0.03] hover:text-[#F1F1F1]"
                                                        >
                                                            View all results for &quot;{normalizedPreviewQuery}&quot;
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </form>

                                    {/* Trending chips — horizontal scroll on narrow screens */}
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-[#444]">
                                            Hot:
                                        </span>
                                        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                            {["1TB NVMe", "DDR5 Ram", "Wireless Mouse"].map((term) => (
                                                <button
                                                    key={term}
                                                    type="button"
                                                    onClick={() => setSearchDraft(term)}
                                                    className="shrink-0 rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px] text-[#888] transition active:scale-[0.98] hover:border-[#D12B28]/40 hover:bg-[#D12B28]/8 hover:text-[#F1F1F1]"
                                                >
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="relative hidden min-h-[28rem] overflow-hidden rounded-2xl border border-white/[0.06] bg-[#101010]/80 lg:flex lg:items-center lg:justify-center">
                                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(209,43,40,0.14),transparent_55%)]" aria-hidden />
                                    <p
                                        className="pointer-events-none absolute right-[4%] top-1/2 z-[1] -translate-y-1/2 select-none font-black uppercase leading-none tracking-[0.12em] text-[#D12B28]/[0.22] [writing-mode:vertical-rl] text-[clamp(3.25rem,11vw,7.5rem)] sm:right-[10%] lg:right-[2%]"
                                        aria-hidden
                                    >
                                        Parts
                                    </p>
                                    <div
                                        className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center p-3"
                                        aria-hidden
                                    >
                                        <div className="relative h-72 w-full max-w-[42rem] sm:h-80 lg:h-96">
                                            <Image
                                                src={withLogoCacheBust("/logos/pc.png")}
                                                alt=""
                                                fill
                                                className="object-contain object-center drop-shadow-[0_8px_32px_rgba(209,43,40,0.18)]"
                                                sizes="(min-width: 1024px) 42rem, 0"
                                                priority
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Category cards */}
                            <div className="border-t border-white/[0.05] px-4 pb-5 pt-4 sm:px-7 sm:pb-8 sm:pt-5 lg:px-10 lg:pb-9">
                                <p className="mb-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#565656] sm:mb-3">
                                    Which lane are you shopping?  - Browse by Category
                                </p>
                                <div className="relative isolate grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3.5">
                                    {categories.map((category) => {
                                        return (
                                            <Link
                                                key={category.slug}
                                                href={`/shop/${category.slug}`}
                                                className="group relative z-0 flex min-h-[6.5rem] flex-col items-start gap-2.5 overflow-visible rounded-xl border border-white/[0.1] bg-[linear-gradient(155deg,#1b1b1b_0%,#151515_55%,#101010_100%)] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:z-30 hover:-translate-y-0.5 hover:border-[#D12B28]/50 hover:shadow-[0_14px_30px_rgba(0,0,0,0.42),0_0_0_1px_rgba(209,43,40,0.12)] sm:min-h-0 sm:gap-3 sm:p-4"
                                            >
                                                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0)_45%)]" />
                                                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.52)_0%,rgba(0,0,0,0.18)_55%,rgba(0,0,0,0)_100%)]" />
                                                <div className="pointer-events-none absolute -left-8 bottom-0 h-20 w-20 translate-y-6 rounded-full bg-white/[0.03] blur-2xl" />
                                                <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-[#D12B28]/0 blur-2xl transition-all duration-500 group-hover:bg-[#D12B28]/18" />
                                                <div className={`pointer-events-none absolute z-[2] opacity-90 transition-all duration-500 group-hover:opacity-100 ${category.imageClassName}`} aria-hidden>
                                                    <Image
                                                        src={withLogoCacheBust(category.imageSrc)}
                                                        alt=""
                                                        fill
                                                        className="object-contain drop-shadow-[0_14px_34px_rgba(209,43,40,0.36)] transition-transform duration-500 group-hover:scale-105"
                                                        sizes="120px"
                                                    />
                                                </div>
                                                <div className="relative z-10 flex w-full items-start justify-between gap-2">
                                                    <span className="inline-block max-w-[min(100%,11rem)] rounded-md border border-[#D12B28]/35 bg-gradient-to-br from-[#D12B28]/26 via-[#D12B28]/12 to-white/[0.04] px-2.5 py-1.5 text-left text-[12px] font-semibold leading-snug tracking-tight text-white shadow-[0_0_24px_rgba(209,43,40,0.12),inset_0_1px_0_rgba(255,255,255,0.08)] sm:px-3 sm:text-[14px]">
                                                        {category.label}
                                                    </span>
                                                </div>
                                                <span className="relative z-10 mt-auto flex items-center gap-1.5 text-[11px] font-medium text-[#8A8A8A] transition-colors duration-300 group-hover:text-[#D12B28]">
                                                    Browse
                                                    <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                                                </span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Featured — same visual chapter as discover */}
                <section className="relative py-10 sm:py-16 lg:py-20" aria-labelledby="featured-heading">
                    <div className="mx-auto max-w-[96rem] px-3 sm:px-6 lg:px-8">
                        <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:mb-12">
                            <FlowSectionHeader
                                className="mb-0 min-w-0 sm:mb-0 sm:flex-1 lg:mb-0"
                                titleId="featured-heading"
                                watermark="FEATURED"
                                watermarkAlign="right"
                                eyebrow="Spotlight"
                                title="Hand-picked hardware"
                                description="Clean selection. Proven performance."
                            />
                            <Link
                                href="/shop"
                                className="inline-flex w-fit shrink-0 items-center gap-2 text-sm font-semibold text-[#D12B28] transition hover:text-[#F1F1F1]"
                            >
                                View all <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c0c]/85 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:rounded-[1.75rem] sm:p-7 lg:p-10">
                            <div className="pointer-events-none absolute -right-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[#D12B28]/[0.06] blur-3xl" aria-hidden />
                            {loadingFeatured ? (
                                <div className="flex min-h-[16rem] items-center justify-center">
                                    <LoadingAnimation size="md" label="Loading featured products..." />
                                </div>
                            ) : featuredProducts.length === 0 ? (
                                <div className="rounded-xl border border-white/[0.06] bg-[#141414] px-6 py-12 text-center text-[#8E8E8E]">
                                    No featured products.
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-12 items-center justify-start pl-1 sm:w-14 sm:pl-2">
                                        <button
                                            type="button"
                                            onClick={() => handleFeaturedArrow(-1)}
                                            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-[#141414]/95 text-[#F1F1F1] transition hover:border-[#D12B28]/40 hover:bg-[#1a1a1a] hover:text-[#D12B28] sm:h-11 sm:w-11"
                                            aria-label="Previous featured products"
                                        >
                                            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                                        </button>
                                    </div>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-12 items-center justify-end pr-1 sm:w-14 sm:pr-2">
                                        <button
                                            type="button"
                                            onClick={() => handleFeaturedArrow(1)}
                                            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-[#141414]/95 text-[#F1F1F1] transition hover:border-[#D12B28]/40 hover:bg-[#1a1a1a] hover:text-[#D12B28] sm:h-11 sm:w-11"
                                            aria-label="Next featured products"
                                        >
                                            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                                        </button>
                                    </div>
                                    <div
                                        className="overflow-hidden px-12 pb-2 pt-3 sm:px-14 lg:px-0"
                                        role="region"
                                        aria-roledescription="carousel"
                                        aria-label="Featured products"
                                    >
                                        <div
                                            ref={featuredTrackRef}
                                            onTransitionEnd={handleFeaturedTransitionEnd}
                                            className="flex gap-4 lg:gap-6"
                                            style={{
                                                transform: `translate3d(${-featuredOffset}px, 0, 0)`,
                                                transition: featuredAnimate
                                                    ? `transform ${FEATURED_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                                                    : "none",
                                                willChange: "transform",
                                            }}
                                        >
                                            {featuredLoopedProducts.map(({ product, copyIdx }) => (
                                                <div
                                                    key={`${product._id}-${copyIdx}`}
                                                    data-featured-slider-item
                                                    className="w-[17rem] shrink-0 lg:w-[20rem]"
                                                >
                                                    <ProductCard
                                                        product={product}
                                                        showWhatsAppButton={false}
                                                        showOrderNowButton
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {showDiscountedProductsRow && (
                    <section className="relative py-10 sm:py-16 lg:py-20" aria-labelledby="discounted-heading">
                        <div className="mx-auto max-w-[96rem] px-3 sm:px-6 lg:px-8">
                            <div className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:mb-12">
                                <FlowSectionHeader
                                    className="mb-0 min-w-0 sm:mb-0 sm:flex-1 lg:mb-0"
                                    titleId="discounted-heading"
                                    watermark="DISCOUNTED"
                                    watermarkAlign="right"
                                    eyebrow="Deals"
                                    title="Discounted products"
                                    description="Price drops across popular hardware."
                                />
                                <Link
                                    href="/shop"
                                    className="inline-flex w-fit shrink-0 items-center gap-2 text-sm font-semibold text-[#D12B28] transition hover:text-[#F1F1F1]"
                                >
                                    View all <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>

                            <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c0c0c]/85 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:rounded-[1.75rem] sm:p-7 lg:p-10">
                                <div className="pointer-events-none absolute -right-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[#D12B28]/[0.06] blur-3xl" aria-hidden />
                                {loadingDiscounted ? (
                                    <div className="flex min-h-[16rem] items-center justify-center">
                                        <LoadingAnimation size="md" label="Loading discounted products..." />
                                    </div>
                                ) : discountedProducts.length === 0 ? (
                                    <div className="rounded-xl border border-white/[0.06] bg-[#141414] px-6 py-12 text-center text-[#8E8E8E]">
                                        No discounted products.
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-12 items-center justify-start pl-1 sm:w-14 sm:pl-2">
                                            <button
                                                type="button"
                                                onClick={() => handleDiscountedArrow(-1)}
                                                className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-[#141414]/95 text-[#F1F1F1] transition hover:border-[#D12B28]/40 hover:bg-[#1a1a1a] hover:text-[#D12B28] sm:h-11 sm:w-11"
                                                aria-label="Previous discounted products"
                                            >
                                                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                                            </button>
                                        </div>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-12 items-center justify-end pr-1 sm:w-14 sm:pr-2">
                                            <button
                                                type="button"
                                                onClick={() => handleDiscountedArrow(1)}
                                                className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-[#141414]/95 text-[#F1F1F1] transition hover:border-[#D12B28]/40 hover:bg-[#1a1a1a] hover:text-[#D12B28] sm:h-11 sm:w-11"
                                                aria-label="Next discounted products"
                                            >
                                                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                                            </button>
                                        </div>
                                        <div
                                            className="overflow-hidden px-12 pb-2 pt-3 sm:px-14 lg:px-0"
                                            role="region"
                                            aria-roledescription="carousel"
                                            aria-label="Discounted products"
                                        >
                                            <div
                                                ref={discountedTrackRef}
                                                onTransitionEnd={handleDiscountedTransitionEnd}
                                                className="flex gap-4 lg:gap-6"
                                                style={{
                                                    transform: `translate3d(${-discountedOffset}px, 0, 0)`,
                                                    transition: discountedAnimate
                                                        ? `transform ${FEATURED_SLIDE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
                                                        : "none",
                                                    willChange: "transform",
                                                }}
                                            >
                                                {discountedLoopedProducts.map(({ product, copyIdx }) => (
                                                    <div
                                                        key={`${product._id}-${copyIdx}`}
                                                        data-discounted-slider-item
                                                        className="w-[17rem] shrink-0 lg:w-[20rem]"
                                                    >
                                                        <ProductCard
                                                            product={product}
                                                            showWhatsAppButton={false}
                                                            showOrderNowButton
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* Services — before partners, matching reference story beat */}
                <section className="relative py-10 sm:py-16 lg:py-20" aria-labelledby="services-heading">
                    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                        <FlowSectionHeader
                            titleId="services-heading"
                            watermark="TRUST"
                            watermarkAlign="right"
                            eyebrow="WHY SHOP HERE"
                            title="Not Just Parts. People Behind Them"
                            description="Because building a PC should feel personal, not transactional."
                        />
                        <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
                            {servicePillars.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.title}
                                        className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-[#121212]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#D12B28]/25 sm:gap-4 sm:rounded-2xl sm:p-5"
                                    >
                                        <div className="shrink-0 rounded-lg border border-[#D12B28]/25 bg-[#D12B28]/12 p-3 shadow-[0_0_24px_rgba(209,43,40,0.12)] sm:rounded-xl sm:p-3.5">
                                            <Icon className="h-5 w-5 text-[#D12B28]" aria-hidden />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-[15px] font-semibold leading-snug text-[#F1F1F1] sm:text-base">
                                                {item.title}
                                            </h3>
                                            <p className="mt-1.5 text-[13px] leading-relaxed text-[#B0B0B0] sm:text-sm">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                {/* Partners — marquee */}
                <section
                    className="relative w-full overflow-hidden py-9 sm:py-14"
                    aria-labelledby="top-brands-heading"
                >
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.3)_50%,transparent_92%)]"
                        aria-hidden
                    />
                    <div className="relative mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                        <FlowSectionHeader
                            className="mb-6 sm:mb-10"
                            titleId="top-brands-heading"
                            watermark="PARTNERS"
                            watermarkAlign="right"
                            eyebrow="BRANDS"
                            title="Hardware From Brands Builders Know"
                            description="Carefully selected products from brands trusted for performance, reliability, and innovation."
                        />
                    </div>

                    <div className="relative mt-2 w-full sm:mt-4">
                        <div
                            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-14 bg-gradient-to-r from-[#0d0d0d] via-[#0d0d0d]/95 to-transparent sm:w-20 md:w-28"
                            aria-hidden
                        />
                        <div
                            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-14 bg-gradient-to-l from-[#0d0d0d] via-[#0d0d0d]/95 to-transparent sm:w-20 md:w-28"
                            aria-hidden
                        />
                        <div className="flex w-max py-2 brand-marquee-track sm:py-3">
                            {([0, 1, 2] as const).map((copyIndex) => (
                                <div
                                    key={copyIndex}
                                    className={`brand-marquee-segment flex shrink-0 items-center gap-6 pr-6 sm:gap-9 sm:pr-9 ${copyIndex > 0 ? "brand-marquee-segment-duplicate" : ""}`}
                                    aria-hidden={copyIndex > 0 ? true : undefined}
                                >
                                    {topBrands.map((brand, brandIndex) => (
                                        <div
                                            key={`${copyIndex}-${brand._id || `${brand.name}-${brandIndex}`}`}
                                            className="group flex h-[4.5rem] w-[10.5rem] shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#141414] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color] duration-300 hover:border-[#D12B28]/30 hover:bg-[#181818] sm:h-[5.25rem] sm:w-[12.25rem] sm:rounded-[1.35rem] sm:px-5"
                                        >
                                            {brand.logoUrl ? (
                                                <div className="relative h-10 w-[8rem] sm:h-12 sm:w-[9.5rem]">
                                                    <Image
                                                        src={withLogoCacheBust(brand.logoUrl)}
                                                        alt={copyIndex === 0 ? `${brand.name} logo` : ""}
                                                        fill
                                                        className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.04]"
                                                        sizes="(max-width: 640px) 160px, 200px"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="text-sm font-semibold tracking-wide text-white/85">{brand.name}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CTA — closes the arc */}
                <section className="relative pb-16 pt-2 sm:pb-28 sm:pt-4">
                    <div
                        className="pointer-events-none absolute -bottom-8 right-[-12%] h-[min(70vw,22rem)] w-[min(70vw,22rem)] rounded-full bg-[#D12B28]/[0.07] blur-[90px] sm:right-0"
                        aria-hidden
                    />
                    <div className="relative mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                        <div className="relative overflow-hidden rounded-2xl border border-[#D12B28]/40 bg-[#101010] p-5 sm:rounded-[1.75rem] sm:p-11 lg:p-12">
                            <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(209,43,40,0.22),transparent_65%)]" aria-hidden />
                            <div className="relative flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-center lg:justify-between">
                                <div className="max-w-2xl">
                                    <h2 className="text-xl font-bold leading-snug text-[#F1F1F1] sm:text-2xl lg:text-3xl">
                                        Ready to start your build?
                                    </h2>
                                    <p className="mt-2 text-sm leading-relaxed text-[#B0B0B0] sm:mt-3 sm:text-base">
                                        Explore the catalog, compare the essentials, and assemble a setup that fits your performance target.
                                    </p>
                                </div>
                                <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-3">
                                    <Link
                                        href="/shop"
                                        className="inline-flex w-full items-center justify-center rounded-xl bg-[#D12B28] px-6 py-3 text-sm font-bold text-[#F1F1F1] shadow-[0_0_24px_rgba(209,43,40,0.25)] transition hover:bg-[#E53A36] hover:shadow-[0_0_28px_rgba(209,43,40,0.4)] sm:w-auto sm:px-8"
                                    >
                                        Launch PC Builder
                                    </Link>
                                    <Link
                                        href="/services"
                                        className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-transparent px-6 py-3 text-sm font-bold text-[#F1F1F1] transition hover:border-[#D12B28]/45 hover:bg-white/[0.04] sm:w-auto sm:px-8"
                                    >
                                        Build help
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Reviews: heading → full-width write a review → full-width recent strip */}
                <section
                    className="relative py-10 pb-16 sm:py-16 sm:pb-24 lg:py-20"
                    aria-labelledby="shop-reviews-strip-heading"
                >
                    <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
                        <FlowSectionHeader
                            titleId="shop-reviews-strip-heading"
                            watermark="REVIEWS"
                            watermarkAlign="right"
                            eyebrow="Reviews"
                            title="What customers say"
                            description="Share your experience."
                            className="mb-6 sm:mb-10 lg:mb-12"
                        />
                    </div>

                    <div className="relative w-full border-t border-white/[0.07] bg-[#0c0c0c]/95">
                        <div
                            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]"
                            aria-hidden
                        />
                        <div className="mx-auto max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-4 sm:mb-6 sm:pb-5">
                                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#D12B28] shadow-[0_0_6px_#D12B28]" />
                                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                                    Write a review
                                </span>
                            </div>
                            <DeferredReviewForm variant="shop" wide />
                        </div>
                    </div>

                    <div className="relative mt-0 w-full">
                        <DeferredShopReviewsStrip fullWidthStrip />
                    </div>
                </section>

                <HomeFaqSection />
            </div>
        </div>
    );
}
