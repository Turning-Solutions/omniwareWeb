"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    Cpu,
    HardDrive,
    Headphones,
    LifeBuoy,
    MemoryStick,
    Mouse,
    Search,
    ShieldCheck,
    Truck,
    X,
} from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import PromotionStripe from "@/components/PromotionStripe";
import LoadingAnimation from "@/components/LoadingAnimation";
import FlowSectionHeader from "@/components/FlowSectionHeader";
import ShopReviewsStrip from "@/components/ShopReviewsStrip";
import ReviewForm from "@/components/reviews/ReviewForm";

const SEARCH_PREVIEW_DEBOUNCE_MS = 320;

/**
 * Partner logos on the home page are listed in `topBrands` below; each `logo` path is served from
 * `client/public/logos/` (URLs like `/logos/...`). If you overwrite a file but keep the same name,
 * Next.js Image cache and the browser may still show the old file — set `NEXT_PUBLIC_LOGO_ASSET_VERSION`
 * in `.env.local` to a new value (e.g. `2`) or delete `.next` and hard-refresh.
 */
function withLogoCacheBust(path: string): string {
    const v = process.env.NEXT_PUBLIC_LOGO_ASSET_VERSION?.trim();
    return v ? `${path}?v=${encodeURIComponent(v)}` : path;
}

export default function Home() {
    const router = useRouter();
    const [searchDraft, setSearchDraft] = useState("");
    const [previewQuery, setPreviewQuery] = useState("");

    const { data: featuredData, isLoading: loadingFeatured, isFetching: fetchingFeatured } = useProducts({
        limit: 4,
        sort: "newest",
        isFeatured: true,
        includeFacets: false,
    });
    const featuredProducts = featuredData?.products || [];
    const normalizedPreviewQuery = previewQuery.trim();
    const shouldShowPreview = normalizedPreviewQuery.length > 0;
    const { data: previewData, isFetching: loadingPreview } = useProducts({
        search: shouldShowPreview ? normalizedPreviewQuery : undefined,
        limit: 4,
        sort: "newest",
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

    /**
     * `slug` must match each category’s `slug` in Admin → Categories (lowercase recommended).
     */
    const categories = [
        { label: "RAM", slug: "ram", icon: MemoryStick },
        { label: "Mouse", slug: "mouse", icon: Mouse },
        { label: "Storage", slug: "storage", icon: HardDrive },
        { label: "Headset", slug: "headset", icon: Headphones },
    ];

    const topBrands = [
        { name: "NVIDIA", logo: "/logos/nvidia-logo-vert.png" },
        { name: "AMD", logo: "/logos/AMD_Logo.svg.png" },
        { name: "Intel", logo: "/logos/Intel_logo_2023.svg.png" },
        { name: "Corsair", logo: "/logos/CORSAIRLogo.png" },
        { name: "Samsung", logo: "/logos/Samsung_old_logo_before_year_2015.svg.png" },
        { name: "MSI", logo: "/logos/Msi_Logo.png" },
    ] as const;
    const servicePillars = [
        {
            title: "Trusted Inventory",
            description: "Top-tier hardware from brands builders already know and use.",
            icon: ShieldCheck
        },
        {
            title: "Fast Fulfillment",
            description: "Quick delivery and careful packaging for sensitive components.",
            icon: Truck
        },
        {
            title: "Build Guidance",
            description: "Get help choosing balanced parts for gaming, work, or hybrid builds.",
            icon: Cpu
        },
        {
            title: "Support When You Need It",
            description: "Questions about compatibility or your order, we are here to help you ship the build.",
            icon: LifeBuoy
        }
    ];

    return (
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] text-[#F1F1F1]">
            <PromotionStripe asHero />

            {/* One continuous storefront canvas — gradient ties sections together */}
            <div className="relative flex flex-col bg-[linear-gradient(180deg,#080808_0%,#0c0c0c_18%,#101010_45%,#0d0d0d_72%,#0a0a0a_100%)] pb-6 sm:pb-8">
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
            <section className="relative pt-6 sm:pt-8 lg:pt-10">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-[#0c0c0c]/90 shadow-[0_28px_90px_rgba(0,0,0,0.5)] backdrop-blur-sm">

                        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_5%,rgba(209,43,40,0.65)_50%,transparent_95%)]" />
                        <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-[#D12B28]/10 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#D12B28]/6 blur-3xl" />

                        <div className="relative grid gap-8 p-5 sm:p-7 lg:grid-cols-[1fr_minmax(0,0.95fr)] lg:items-start lg:gap-10 lg:p-10">
                            <div className="relative min-w-0">
                                <FlowSectionHeader
                                    watermark="SHOP"
                                    eyebrow="Discover"
                                    title="Find the parts your build is missing"
                                    description="Search the catalog, jump to a category, or scan what is trending, everything below flows from here."
                                />
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#D12B28] shadow-[0_0_6px_#D12B28]" />
                                        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                                            Find items
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                        href="/shop"
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#D12B28] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_0_14px_rgba(209,43,40,0.4)] transition hover:bg-[#E53A36]"
                                    >
                                        Shop All <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                    <Link
                                        href="/services"
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/80 transition hover:border-[#D12B28]/40 hover:text-white"
                                    >
                                        Build Help
                                    </Link>
                                    </div>
                                </div>

                            {/* Search bar — matches shop page behaviour */}
                            <form id="home-search-form" role="search" onSubmit={handleSearchSubmit} className="relative">
                                <label className="sr-only" htmlFor="home-search">Search products</label>
                                <div className="group relative flex min-h-[3.25rem] items-center gap-3 rounded-2xl border border-white/10 bg-[#161616] px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow] focus-within:border-[#D12B28]/60 focus-within:shadow-[0_0_0_3px_rgba(209,43,40,0.18),inset_0_1px_0_rgba(255,255,255,0.05)]">
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
                                        placeholder="Search GPUs, CPUs, RAM, SSDs, PSUs..."
                                        value={searchDraft}
                                        onChange={(e) => setSearchDraft(e.target.value)}
                                        className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[15px] text-[#F1F1F1] caret-[#D12B28] placeholder:text-[#444] focus:outline-none focus:ring-0 sm:text-base"
                                    />
                                    {searchDraft && (
                                        <button
                                            type="button"
                                            onClick={clearSearch}
                                            aria-label="Clear search"
                                            className="rounded-lg p-1.5 text-[#555] transition hover:bg-white/10 hover:text-[#F1F1F1]"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="shrink-0 rounded-xl bg-[#D12B28] px-5 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(209,43,40,0.35)] transition hover:bg-[#E53A36] hover:shadow-[0_0_24px_rgba(209,43,40,0.5)]"
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
                                                        const effectiveDiscountPercent = product.effectiveDiscountPercent ?? product.discountPercent ?? null;
                                                        const originalPrice = product.originalPrice ?? product.price;
                                                        const discountedPrice = product.discountedPrice ?? product.price;

                                                        return (
                                                            <li key={product._id}>
                                                                <Link
                                                                    href={productPath}
                                                                    className="group flex items-center gap-3 rounded-lg p-2 transition hover:bg-white/[0.06]"
                                                                >
                                                                    <img
                                                                        src={product.images?.[0] || "/placeholder.svg"}
                                                                        alt={product.title}
                                                                        className="h-12 w-12 rounded-md object-cover"
                                                                    />
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-[11px] text-[#8E8E8E]">{brandLabel}</p>
                                                                        <p className="line-clamp-1 text-sm font-semibold text-[#F1F1F1]">{product.title}</p>
                                                                        {effectiveDiscountPercent != null && effectiveDiscountPercent > 0 ? (
                                                                            <p className="mt-0.5 text-xs font-semibold text-[#D12B28] flex items-baseline gap-2">
                                                                                <span className="text-[#8E8E8E] line-through font-semibold text-[11px]">
                                                                                    LKR {originalPrice.toLocaleString()}
                                                                                </span>
                                                                                <span>LKR {discountedPrice.toLocaleString()}</span>
                                                                                <span className="text-[10px] text-[#F4C5C5] font-bold">-{effectiveDiscountPercent}%</span>
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

                            {/* Trending chips */}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="font-mono text-[10px] uppercase tracking-widest text-[#444]">Hot:</span>
                                {["RTX 5090", "Ryzen 9 9950X", "DDR5 32GB", "Gen5 NVMe", "X870E"].map((term) => (
                                    <button
                                        key={term}
                                        type="button"
                                        onClick={() => setSearchDraft(term)}
                                        className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-[#888] transition hover:border-[#D12B28]/40 hover:bg-[#D12B28]/8 hover:text-[#F1F1F1]"
                                    >
                                        {term}
                                    </button>
                                ))}
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
                        <div className="border-t border-white/[0.05] px-5 pb-5 pt-4 sm:px-7 sm:pb-7 lg:px-10 lg:pb-8">
                            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#4a4a4a]">Which lane are you shopping?</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {categories.map((category) => {
                                    const Icon = category.icon;
                                    return (
                                        <Link
                                            key={category.slug}
                                            href={`/shop/${category.slug}`}
                                            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border border-white/[0.07] bg-[#161616] p-4 transition hover:border-[#D12B28]/40 hover:bg-[#1A1A1A]"
                                        >
                                            <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-[#D12B28]/0 blur-2xl transition-all duration-500 group-hover:bg-[#D12B28]/15" />
                                            <div className="relative z-10 flex w-full items-start justify-between gap-2">
                                                <span className="inline-block max-w-[min(100%,11rem)] rounded-md border border-[#D12B28]/35 bg-gradient-to-br from-[#D12B28]/22 via-[#D12B28]/10 to-white/[0.04] px-2.5 py-1.5 text-left text-[13px] font-bold leading-snug tracking-tight text-white shadow-[0_0_24px_rgba(209,43,40,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] sm:text-[15px]">
                                                    {category.label}
                                                </span>
                                                <div className="shrink-0 rounded-lg border border-white/[0.07] bg-white/[0.04] p-2 transition group-hover:border-[#D12B28]/30 group-hover:bg-[#D12B28]/10">
                                                    <Icon className="h-4 w-4 text-[#D12B28]" />
                                                </div>
                                            </div>
                                            <span className="relative z-10 flex items-center gap-1 text-[11px] font-medium text-[#5C5C5C] transition group-hover:text-[#D12B28]">
                                                Browse <ArrowRight className="h-3 w-3" />
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
            <section className="relative py-14 sm:py-16 lg:py-20" aria-labelledby="featured-heading">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="mb-8 flex flex-col gap-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between lg:mb-12">
                        <FlowSectionHeader
                            className="mb-0 sm:mb-0 lg:mb-0"
                            titleId="featured-heading"
                            watermark="FEATURED"
                            watermarkAlign="right"
                            eyebrow="Spotlight"
                            title="Hand-picked hardware"
                            description="Fresh drops and standout SKUs we would put in our own rigs, same cards, cleaner path to checkout."
                        />
                        <Link
                            href="/shop"
                            className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#D12B28] transition hover:text-[#F1F1F1]"
                        >
                            View all <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-[#0c0c0c]/85 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-7 lg:p-8">
                        <div className="pointer-events-none absolute -right-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[#D12B28]/[0.06] blur-3xl" aria-hidden />
                        {loadingFeatured ? (
                            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="aspect-[3/4] animate-pulse rounded-xl border border-white/[0.06] bg-[#161616]" />
                                ))}
                            </div>
                        ) : featuredProducts.length === 0 ? (
                            <div className="rounded-xl border border-white/[0.06] bg-[#141414] px-6 py-12 text-center text-[#8E8E8E]">
                                No featured products.
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                                    {featuredProducts.map((product) => (
                                        <ProductCard
                                            key={product._id}
                                            product={product}
                                            showWhatsAppButton={false}
                                            showOrderNowButton
                                        />
                                    ))}
                                </div>
                                {fetchingFeatured && (
                                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-[#0c0c0c]/55">
                                        <LoadingAnimation size="sm" label="Updating featured..." className="h-full" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Services — before partners, matching reference story beat */}
            <section className="relative py-14 sm:py-16 lg:py-20" aria-labelledby="services-heading">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <FlowSectionHeader
                        titleId="services-heading"
                        watermark="TRUST"
                        eyebrow="Why shop here"
                        title="More than a parts list"
                        description="From inventory to delivery, the experience is built for people who actually assemble systems, not just scroll specs."
                    />
                    <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                        {servicePillars.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.title}
                                    className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-[#121212]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#D12B28]/25"
                                >
                                    <div className="shrink-0 rounded-xl border border-[#D12B28]/25 bg-[#D12B28]/12 p-3.5 shadow-[0_0_24px_rgba(209,43,40,0.12)]">
                                        <Icon className="h-5 w-5 text-[#D12B28]" aria-hidden />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-semibold text-[#F1F1F1]">{item.title}</h3>
                                        <p className="mt-1.5 text-sm leading-relaxed text-[#B0B0B0]">{item.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Partners — marquee */}
            <section
                className="relative w-full overflow-hidden py-12 sm:py-14"
                aria-labelledby="top-brands-heading"
            >
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.3)_50%,transparent_92%)]"
                    aria-hidden
                />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <FlowSectionHeader
                        className="mb-8 sm:mb-10"
                        titleId="top-brands-heading"
                        watermark="PARTNERS"
                        watermarkAlign="right"
                        eyebrow="Brands"
                        title="Names you already trust"
                        description="GPUs, CPUs, memory, storage, and boards from vendors builders recognize on sight."
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
                                {topBrands.map((brand) => (
                                    <div
                                        key={`${copyIndex}-${brand.name}`}
                                        className="group flex h-[4.5rem] w-[10.5rem] shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#141414] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color] duration-300 hover:border-[#D12B28]/30 hover:bg-[#181818] sm:h-[5.25rem] sm:w-[12.25rem] sm:rounded-[1.35rem] sm:px-5"
                                    >
                                        <div className="relative h-10 w-[8rem] sm:h-12 sm:w-[9.5rem]">
                                            <Image
                                                src={withLogoCacheBust(brand.logo)}
                                                alt={copyIndex === 0 ? `${brand.name} logo` : ""}
                                                fill
                                                className="object-contain object-center transition-transform duration-300 group-hover:scale-[1.04]"
                                                sizes="(max-width: 640px) 160px, 200px"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA — closes the arc */}
            <section className="relative pb-24 pt-4 sm:pb-28">
                <div
                    className="pointer-events-none absolute -bottom-8 right-[-12%] h-[min(70vw,22rem)] w-[min(70vw,22rem)] rounded-full bg-[#D12B28]/[0.07] blur-[90px] sm:right-0"
                    aria-hidden
                />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="relative overflow-hidden rounded-[1.75rem] border border-[#D12B28]/40 bg-[#101010] p-8 sm:p-11 lg:p-12">
                        <p
                            className="pointer-events-none absolute -bottom-6 -right-4 select-none font-bold uppercase leading-none tracking-tight text-[#D12B28]/[0.07] text-[clamp(3rem,14vw,7rem)] sm:-right-2"
                            aria-hidden
                        >
                            BUILD
                        </p>
                        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(209,43,40,0.22),transparent_65%)]" aria-hidden />
                        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-2xl">
                                <h2 className="text-2xl font-bold text-[#F1F1F1] sm:text-3xl">Ready to start your build?</h2>
                                <p className="mt-3 text-[#B0B0B0]">
                                    Explore the catalog, compare the essentials, and assemble a setup that fits your performance target.
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Link
                                    href="/shop"
                                    className="inline-flex items-center justify-center rounded-xl bg-[#D12B28] px-8 py-3 font-bold text-[#F1F1F1] shadow-[0_0_24px_rgba(209,43,40,0.25)] transition hover:bg-[#E53A36] hover:shadow-[0_0_28px_rgba(209,43,40,0.4)]"
                                >
                                    Launch PC Builder
                                </Link>
                                <Link
                                    href="/services"
                                    className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-transparent px-8 py-3 font-bold text-[#F1F1F1] transition hover:border-[#D12B28]/45 hover:bg-white/[0.04]"
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
                className="relative py-14 sm:py-16 lg:py-20 pb-20 sm:pb-24"
                aria-labelledby="shop-reviews-strip-heading"
            >
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <FlowSectionHeader
                        titleId="shop-reviews-strip-heading"
                        watermark="REVIEWS"
                        watermarkAlign="right"
                        eyebrow="Reviews"
                        title="What customers say"
                        description="Share your experience."
                        className="mb-8 sm:mb-10 lg:mb-12"
                    />
                </div>

                <div className="relative w-full border-t border-white/[0.07] bg-[#0c0c0c]/95">
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]"
                        aria-hidden
                    />
                    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
                        <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-5">
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#D12B28] shadow-[0_0_6px_#D12B28]" />
                            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                                Write a review
                            </span>
                        </div>
                        <ReviewForm variant="shop" wide />
                    </div>
                </div>

                <div className="relative mt-0 w-full">
                    <ShopReviewsStrip fullWidthStrip />
                </div>
            </section>
            </div>
        </div>
    );
}
