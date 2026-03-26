"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    Cpu,
    HardDrive,
    MemoryStick,
    Monitor,
    Search,
    ShieldCheck,
    Truck,
    X,
} from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import PromotionStripe from "@/components/PromotionStripe";
import LoadingAnimation from "@/components/LoadingAnimation";

const SEARCH_PREVIEW_DEBOUNCE_MS = 320;

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

    /** Paths use Category.slug from your database (see /admin categories). */
    const categories = [
        { label: "Graphics Cards", icon: Monitor, href: "/shop/graphics-cards" },
        { label: "Processors", icon: Cpu, href: "/shop/processors" },
        { label: "Memory", icon: MemoryStick, href: "/shop/RAM" },
        { label: "Storage", icon: HardDrive, href: "/shop/storage" },
    ];

    const brands = ["NVIDIA", "AMD", "Intel", "Corsair", "Samsung", "MSI"];
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
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-[#121212] text-[#F1F1F1]">
            <PromotionStripe asHero />

            {/* Search & Browse */}
            <section className="pb-8 pt-2 sm:pb-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#0D0D0D] shadow-[0_24px_80px_rgba(0,0,0,0.55)]">

                        {/* top accent line */}
                        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_5%,rgba(209,43,40,0.7)_50%,transparent_95%)]" />
                        {/* ambient glows */}
                        <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-[#D12B28]/10 blur-3xl" />
                        <div className="pointer-events-none absolute -left-24 bottom-0 h-56 w-56 rounded-full bg-[#D12B28]/6 blur-3xl" />

                        {/* Search area */}
                        <div className="p-5 sm:p-7 lg:p-8">

                            {/* label row */}
                            <div className="mb-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#D12B28] shadow-[0_0_6px_#D12B28]" />
                                    <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                                        Find Items
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
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

                        {/* Category cards */}
                        <div className="border-t border-white/[0.05] px-5 pb-5 pt-4 sm:px-7 sm:pb-7 lg:px-8 lg:pb-8">
                            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-[#3A3A3A]">// Browse by category</p>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                {categories.map((category) => {
                                    const Icon = category.icon;
                                    return (
                                        <Link
                                            key={category.label}
                                            href={category.href}
                                            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border border-white/[0.07] bg-[#161616] p-4 transition hover:border-[#D12B28]/40 hover:bg-[#1A1A1A]"
                                        >
                                            <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 translate-x-6 -translate-y-6 rounded-full bg-[#D12B28]/0 blur-2xl transition-all duration-500 group-hover:bg-[#D12B28]/15" />
                                            <div className="rounded-lg border border-white/[0.07] bg-white/[0.04] p-2.5 transition group-hover:border-[#D12B28]/30 group-hover:bg-[#D12B28]/10">
                                                <Icon className="h-4 w-4 text-[#D12B28]" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-[#E0E0E0] transition group-hover:text-white">{category.label}</p>
                                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#555] transition group-hover:text-[#D12B28]/80">
                                                    Browse <ArrowRight className="h-3 w-3" />
                                                </p>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Featured Shelf */}
            <section className="border-y border-[#5E5E5E]/30 bg-[#181818] py-14">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="rounded-[2rem] border border-[#5E5E5E]/35 bg-[#121212] p-6 sm:p-8">
                        <div className="mb-8 flex justify-between items-end">
                            <div>
                                <h2 className="text-3xl font-bold text-[#F1F1F1] mb-2">Featured Components</h2>
                                
                            </div>
                            <Link href="/shop" className="text-[#D12B28] hover:text-[#F1F1F1] transition-colors flex items-center gap-2">
                                View All <ArrowRight className="h-4 w-4" />
                            </Link>
                        </div>

                        {loadingFeatured ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="rounded-xl aspect-[3/4] animate-pulse border border-[#5E5E5E]/40 bg-[#242424]" />
                                ))}
                            </div>
                        ) : featuredProducts.length === 0 ? (
                            <div className="rounded-2xl border border-[#5E5E5E]/35 bg-[#181818] px-6 py-10 text-center text-[#8E8E8E]">
                                No featured products.
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
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
                                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[#121212]/50">
                                        <LoadingAnimation size="sm" label="Updating featured..." className="h-full" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Brand + Benefits */}
            <section className="py-14">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                        <div className="rounded-[2rem] border border-[#5E5E5E]/35 bg-[#181818] p-6 sm:p-8">
                            <h2 className="text-2xl font-bold text-[#F1F1F1]">Top Brands in Stock</h2>
                            <p className="mt-2 text-sm text-[#B0B0B0]">A curated mix of trusted vendors across every major component category.</p>
                            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                {brands.map((brand) => (
                                    <div
                                        key={brand}
                                        className="rounded-2xl border border-[#5E5E5E]/45 bg-[#242424] py-4 text-center text-sm font-semibold text-[#F1F1F1]"
                                    >
                                        {brand}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-[#5E5E5E]/35 bg-[#181818] p-6 sm:p-8">
                            <h2 className="text-2xl font-bold text-[#F1F1F1]">Why Builders Choose Us</h2>
                            <p className="mt-2 text-sm text-[#B0B0B0]">Designed for fast decisions, trusted purchases, and clean builds.</p>
                            <div className="mt-6 space-y-4">
                                {servicePillars.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <div
                                            key={item.title}
                                            className="flex items-start gap-4 rounded-2xl border border-[#5E5E5E]/40 bg-[#242424] p-4"
                                        >
                                            <div className="rounded-xl bg-[#D12B28]/12 p-3">
                                                <Icon className="h-5 w-5 text-[#D12B28]" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-[#F1F1F1]">{item.title}</h3>
                                                <p className="mt-1 text-sm leading-6 text-[#B0B0B0]">{item.description}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="pb-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative overflow-hidden rounded-[2rem] border border-[#D12B28]/45 bg-[#1A1A1A] p-8 sm:p-12">
                        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(209,43,40,0.3),_transparent_60%)]" />
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-2xl">
                                <h2 className="text-3xl font-bold text-[#F1F1F1]">Ready to Start Your Build?</h2>
                                <p className="mt-3 text-[#B0B0B0]">
                                    Explore the catalog, compare the essentials, and assemble a setup that fits your performance target.
                                </p>
                            </div>
                            <Link
                                href="/shop"
                                className="inline-flex w-fit items-center justify-center rounded-xl bg-[#D12B28] px-8 py-3 font-bold text-[#F1F1F1] transition-all hover:bg-[#E53A36] hover:shadow-[0_0_20px_rgba(209,43,40,0.35)]"
                            >
                                Launch PC Builder
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
