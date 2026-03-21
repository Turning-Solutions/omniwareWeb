"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    ArrowRight,
    Cpu,
    HardDrive,
    MemoryStick,
    Monitor,
    Search,
    ShieldCheck,
    Truck,
    Zap
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";
import ImageSlider from "@/components/ImageSlider";

export default function Home() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch featured products (assuming we can filter by isFeatured or just take latest)
    // For now, let's take latest products as "featured" or "special offers"
    const { data: featuredData, isLoading: loadingFeatured } = useProducts({ limit: 4, sort: 'newest' });
    const featuredProducts = featuredData?.products || [];

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/shop?search=${encodeURIComponent(searchQuery)}`);
        }
    };

    const heroSlides = [
        "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?q=80&w=2574&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=2574&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?q=80&w=2664&auto=format&fit=crop"
    ];

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
            {/* Store Hero — split layout + sliding imagery */}
            <section className="relative isolate pt-6 pb-12 sm:pt-8 sm:pb-14 lg:pt-10 lg:pb-16">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(209,43,40,0.12),transparent)]" />
                <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="overflow-hidden rounded-[1.75rem] border border-[#5E5E5E]/40 bg-[#181818] shadow-[0_24px_80px_rgba(0,0,0,0.45)] lg:grid lg:min-h-[min(560px,78vh)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                        {/* Copy + actions */}
                        <div className="order-2 flex flex-col justify-center border-t border-[#5E5E5E]/30 p-6 sm:p-8 lg:order-1 lg:border-t-0 lg:border-r lg:border-[#5E5E5E]/30 lg:p-10 xl:p-12">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <span className="inline-flex items-center gap-2 rounded-full border border-[#5E5E5E]/70 bg-[#242424] px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-[#B0B0B0]">
                                    <Zap className="h-3.5 w-3.5 text-[#D12B28]" />
                                    Performance Storefront
                                </span>

                                <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-[#F1F1F1] sm:text-5xl lg:text-[2.75rem] lg:leading-[1.1] xl:text-6xl">
                                    Build around
                                    <span className="block text-[#D12B28]">better hardware.</span>
                                </h1>

                                <p className="mt-4 max-w-md text-[15px] leading-7 text-[#B0B0B0]">
                                    GPUs, CPUs, memory, and storage, browse a focused catalog with live sliding highlights from the shop floor.
                                </p>

                                <motion.form
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.12 }}
                                    onSubmit={handleSearch}
                                    className="relative mt-7 max-w-md"
                                >
                                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8E8E8E]" />
                                    <input
                                        type="text"
                                        enterKeyHint="search"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        placeholder="Search RTX, Ryzen, DDR5, NVMe..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full rounded-2xl border border-[#5E5E5E] bg-[#121212] py-3.5 pl-12 pr-[5.5rem] text-[#F1F1F1] caret-[#D12B28] placeholder:text-[#8E8E8E] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:outline-none focus:ring-2 focus:ring-[#D12B28]/60"
                                    />
                                    <button
                                        type="submit"
                                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-[#D12B28] px-4 py-2 text-sm font-semibold text-[#F1F1F1] transition hover:bg-[#E53A36]"
                                    >
                                        Search
                                    </button>
                                </motion.form>

                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="mt-6 flex flex-wrap gap-3"
                                >
                                    <Link
                                        href="/shop"
                                        className="inline-flex items-center gap-2 rounded-xl bg-[#D12B28] px-5 py-3 text-sm font-semibold text-[#F1F1F1] transition hover:bg-[#E53A36] hover:shadow-[0_0_24px_rgba(209,43,40,0.35)]"
                                    >
                                        Shop All Parts <ArrowRight className="h-4 w-4" />
                                    </Link>
                                    <Link
                                        href="/services"
                                        className="inline-flex items-center gap-2 rounded-xl border border-[#5E5E5E] bg-[#242424] px-5 py-3 text-sm font-semibold text-[#F1F1F1] transition hover:border-[#D12B28]/50"
                                    >
                                        Build Consultation
                                    </Link>
                                </motion.div>

                                {/* Category strip */}
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.28 }}
                                    className="mt-8 flex flex-wrap gap-2"
                                >
                                    {categories.map((category) => {
                                        const Icon = category.icon;
                                        return (
                                            <Link
                                                key={category.label}
                                                href={category.href}
                                                className="inline-flex items-center gap-2 rounded-full border border-[#5E5E5E]/60 bg-[#242424] px-3.5 py-1.5 text-xs font-medium text-[#B0B0B0] transition hover:border-[#D12B28]/50 hover:text-[#F1F1F1]"
                                            >
                                                <Icon className="h-3.5 w-3.5 text-[#D12B28]" />
                                                {category.label}
                                            </Link>
                                        );
                                    })}
                                    <Link
                                        href="/shop"
                                        className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-xs text-[#8E8E8E] transition hover:text-[#F1F1F1]"
                                    >
                                        More <ArrowRight className="h-3 w-3" />
                                    </Link>
                                </motion.div>
                            </motion.div>
                        </div>

                        {/* Sliding hero visuals */}
                        <div className="relative order-1 min-h-[220px] h-[38vh] sm:min-h-[280px] sm:h-[42vh] lg:order-2 lg:h-full lg:min-h-0">
                            <ImageSlider images={heroSlides} variant="hero" autoPlayInterval={5500} />
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
                                <p className="text-[#B0B0B0]">Current standout picks for modern high-performance builds.</p>
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
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {featuredProducts.map((product) => (
                                    <ProductCard key={product._id} product={product} />
                                ))}
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
