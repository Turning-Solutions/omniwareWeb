"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, ShieldCheck, Truck, Search } from "lucide-react";
import ImageSlider from "@/components/ImageSlider";
import { useRouter } from "next/navigation";
import { useProducts } from "@/hooks/useProducts";
import ProductCard from "@/components/ProductCard";

export default function Home() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch featured products (assuming we can filter by isFeatured or just take latest)
    // For now, let's take latest products as "featured" or "special offers"
    const { data: featuredData, isLoading: loadingFeatured } = useProducts({ limit: 4, sort: 'newest' });
    const featuredProducts = featuredData?.products || [];

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            router.push(`/shop?search=${encodeURIComponent(searchQuery)}`);
        }
    };

    const sliderImages = [
        "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?q=80&w=2574&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?q=80&w=2574&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1624705002806-5d72df19c3ad?q=80&w=2664&auto=format&fit=crop"
    ];

    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero Section with Slider */}
            <section className="relative pt-4 pb-12 lg:pt-8 lg:pb-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-8">
                        <motion.h1
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 mb-4"
                        >
                            Build Your Ultimate <br /> Gaming Machine
                        </motion.h1>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="max-w-2xl mx-auto"
                        >
                            <form onSubmit={handleSearch} className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
                                <input
                                    type="text"
                                    placeholder="Search for components (e.g., RTX 4090, Ryzen 7)..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-full py-4 pl-12 pr-4 text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-all backdrop-blur-sm"
                                />
                            </form>
                        </motion.div>
                    </div>

                    <ImageSlider images={sliderImages} />
                </div>
            </section>

            {/* Featured Items / Special Offers */}
            <section className="py-16 bg-black/20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-white mb-2">Featured Items</h2>
                            <p className="text-gray-400">Hand-picked components for high-performance builds.</p>
                        </div>
                        <Link href="/shop" className="text-primary hover:text-white transition-colors flex items-center gap-2">
                            View All <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {loadingFeatured ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="bg-white/5 rounded-xl aspect-[3/4] animate-pulse" />
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
            </section>

            {/* Features Section */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="p-6 rounded-2xl glass"
                        >
                            <Cpu className="h-12 w-12 text-primary mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Premium Components</h3>
                            <p className="text-gray-400">Only the best brands and latest hardware for your setup.</p>
                        </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="p-6 rounded-2xl glass"
                        >
                            <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Expert Assembly</h3>
                            <p className="text-gray-400">Built by professionals with meticulous cable management.</p>
                        </motion.div>
                        <motion.div
                            whileHover={{ scale: 1.05 }}
                            className="p-6 rounded-2xl glass"
                        >
                            <Truck className="h-12 w-12 text-primary mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Island-wide Delivery</h3>
                            <p className="text-gray-400">Safe and secure delivery to your doorstep anywhere in Sri Lanka.</p>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="relative rounded-3xl overflow-hidden glass p-12 text-center">
                        <div className="absolute inset-0 bg-primary/10 -z-10" />
                        <h2 className="text-3xl font-bold text-white mb-4">Ready to Ascend?</h2>
                        <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                            Don&apos;t settle for pre-builts. customize every aspect of your PC to match your needs and style.
                        </p>
                        <Link
                            href="/shop"
                            className="inline-flex px-8 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-colors"
                        >
                            Launch PC Builder
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
