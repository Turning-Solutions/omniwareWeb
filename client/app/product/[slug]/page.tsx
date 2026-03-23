"use client";

import { useState, useEffect, use } from "react";
import { ShoppingCart, Check, Shield, AlertCircle, ChevronDown, ChevronRight, Clock, Package, MessageCircle } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useCart } from "@/context/CartContext";

import { useProduct } from "@/hooks/useProducts";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import LoadingAnimation from "@/components/LoadingAnimation";

interface ProductVariant {
    sku?: string;
    price?: number;
    stock?: { qty?: number };
    attributes?: { name?: string; value: string }[];
}

interface ProductColorVariant {
    name: string;
    hex?: string;
    sku?: string;
    price?: number;
    stock?: { qty?: number };
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = use(params);
    const { data: product, isLoading: loading, error } = useProduct(slug);

    // Local state for image and variants (only when product loads)
    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | ProductColorVariant | null>(null);
    const { addToCart } = useCart();
    const [qty, setQty] = useState(1);
    // Expanded state for product detail categories (default: all open)
    const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({});

    // Reset local state when product changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedImage(0);
        setSelectedVariant(null);
        setQty(1);
        setExpandedGroups({});
    }, [product]);

    // Error UI
    if (error) return <div className="min-h-screen pt-20 text-center text-white">Error loading product</div>;

    if (loading) {
        return (
            <div className="min-h-screen pt-20">
                <LoadingAnimation size="lg" label="Loading product..." className="h-56" />
            </div>
        );
    }

    if (!product) return <div className="min-h-screen pt-20 text-center text-white">Product not found</div>;

    const currentPrice = selectedVariant?.price ?? product.price;
    const currentStock = selectedVariant?.stock?.qty ?? product.stock?.qty;
    const availability = product.availability ?? (currentStock > 0 ? 'in_stock' : 'out_of_stock');

    const availabilityConfig = {
        in_stock: { label: 'In Stock', className: 'text-green-400', icon: Check },
        out_of_stock: { label: 'Out of Stock', className: 'text-red-400', icon: AlertCircle },
        pre_order: { label: 'Pre-Order', className: 'text-yellow-400', icon: Clock },
        coming_soon: { label: 'Coming Soon', className: 'text-blue-400', icon: Package },
    } as const;

    const availInfo = availabilityConfig[availability as keyof typeof availabilityConfig] ?? availabilityConfig.out_of_stock;
    const AvailIcon = availInfo.icon;
    const canAddToCart = availability === 'in_stock' || availability === 'pre_order';
    const productPath = `/product/${product.slug || product._id}`;
    const whatsappUrl = buildProductWhatsAppUrl({
        productTitle: product.title,
        productPath,
    });

    const handleAddToCart = () => {
        const selectedLabel = selectedVariant && "attributes" in selectedVariant
            ? (selectedVariant.attributes ?? []).map((a) => a.value).join("/")
            : selectedVariant && "name" in selectedVariant
                ? selectedVariant.name
                : "";
        const itemToAdd = {
            ...product,
            price: currentPrice,
            // If variant selected, we might want to append variant info to title or id
            // For simple cart context:
            title: selectedVariant
                ? `${product.title} (${selectedLabel})`
                : product.title,
            _id: selectedVariant ? `${product._id}-${selectedVariant.sku ?? selectedLabel}` : product._id
        };
        addToCart(itemToAdd, qty);
        alert("Added to cart!");
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Image Gallery */}
                <div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/5 rounded-2xl aspect-square flex items-center justify-center border border-white/10 mb-4 overflow-hidden"
                    >
                        {product.images && product.images[selectedImage] ? (
                            <div className="relative w-full h-full">
                                <Image
                                    src={product.images[selectedImage]}
                                    alt={product.title}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <span className="text-gray-500 text-lg">No Image Available</span>
                        )}
                    </motion.div>
                    {product.images && product.images.length > 1 && (
                        <div className="flex gap-2 cursor-pointer overflow-x-auto pb-2">
                            {product.images.map((img: string, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedImage(idx)}
                                    className={`w-20 h-20 rounded-lg flex-shrink-0 border ${selectedImage === idx ? 'border-primary' : 'border-transparent'} bg-white/5 overflow-hidden`}
                                >
                                    <div className="relative w-full h-full">
                                        <Image
                                            src={img}
                                            alt=""
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Specs Map (filter specs) */}
                    {product.specs && Object.keys(product.specs).length > 0 && (
                        <div className="mt-6 p-4 bg-white/5 rounded-xl">
                            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" /> Specifications
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                {Object.entries(product.specs).map(([key, value]) => (
                                    <div key={key}>
                                        <span className="block text-gray-500 text-xs uppercase">{key}</span>
                                        <span className="text-gray-300">{value as string}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <div className="mb-2 text-sm text-blue-400 font-semibold tracking-wide uppercase">
                        {typeof product.brandId !== 'string' ? product.brandId?.name : ''}
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">{product.title}</h1>

                    {/* Categories Tags */}
                    {product.categoryIds && product.categoryIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            {product.categoryIds.map((cat: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <span key={cat._id} className="text-xs bg-white/10 px-2 py-1 rounded text-gray-300">
                                    {cat.name}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center space-x-4 mb-6">
                        <span className="text-2xl font-bold text-primary">LKR {currentPrice?.toLocaleString()}</span>
                        <span className={`flex items-center text-sm font-medium ${availInfo.className}`}>
                            <AvailIcon className="h-4 w-4 mr-1" />
                            {availInfo.label}
                        </span>
                    </div>

                    {product.warranty && (
                        <div className="mb-6 inline-flex items-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                            Warranty: {product.warranty}
                        </div>
                    )}

                    {/* Variants Selection */}
                    {product.variants && product.variants.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-gray-300 uppercase mb-3">Options</h3>
                            <div className="flex flex-wrap gap-3">
                                {product.variants.map((variant: ProductVariant, idx: number) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedVariant(variant)}
                                        className={`px-4 py-2 rounded-lg border text-sm transition-all ${selectedVariant === variant
                                            ? 'border-primary bg-primary/10 text-white'
                                            : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        {(variant.attributes ?? []).map((a) => a.value).join(' / ')}
                                        {variant.price != null && (
                                            <span className="ml-2 text-xs opacity-75">LKR {variant.price.toLocaleString()}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {product.colorVariants && product.colorVariants.length > 0 && (
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-gray-300 uppercase mb-3">Colors</h3>
                            <div className="flex flex-wrap gap-3">
                                {product.colorVariants.map((color: ProductColorVariant, idx: number) => (
                                    <button
                                        key={`${color.name}-${idx}`}
                                        onClick={() => setSelectedVariant(color)}
                                        className={`px-4 py-2 rounded-lg border text-sm transition-all inline-flex items-center gap-2 ${
                                            selectedVariant === color
                                                ? 'border-primary bg-primary/10 text-white'
                                                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
                                        }`}
                                    >
                                        <span
                                            className="inline-block h-4 w-4 rounded-full border border-white/20"
                                            style={color.hex ? { backgroundColor: color.hex } : undefined}
                                        />
                                        <span>{color.name}</span>
                                        {color.price != null && (
                                            <span className="ml-1 text-xs opacity-75">LKR {color.price.toLocaleString()}</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-8">
                        <div className="flex gap-4 items-center">
                            {canAddToCart && (
                                <div className="flex items-center bg-white/5 rounded-xl border border-white/10">
                                    <button
                                        onClick={() => setQty(Math.max(1, qty - 1))}
                                        className="px-3 py-2 text-gray-400 hover:text-white"
                                    >-</button>
                                    <span className="w-8 text-center text-white">{qty}</span>
                                    <button
                                        onClick={() => setQty(Math.min(currentStock || 99, qty + 1))}
                                        className="px-3 py-2 text-gray-400 hover:text-white"
                                    >+</button>
                                </div>
                            )}

                            <button
                                onClick={handleAddToCart}
                                disabled={!canAddToCart}
                                className={`flex-1 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                                    availability === 'in_stock'
                                        ? 'bg-primary text-white hover:bg-primary/90'
                                        : availability === 'pre_order'
                                            ? 'bg-yellow-500 text-white hover:bg-yellow-500/90'
                                            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                }`}
                            >
                                {availability === 'in_stock' && <><ShoppingCart className="h-5 w-5" /> Add to Cart</>}
                                {availability === 'pre_order' && <><Clock className="h-5 w-5" /> Pre-Order Now</>}
                                {availability === 'out_of_stock' && <><AlertCircle className="h-5 w-5" /> Out of Stock</>}
                                {availability === 'coming_soon' && <><Package className="h-5 w-5" /> Coming Soon</>}
                            </button>
                            <button className="px-6 py-4 glass rounded-xl hover:bg-white/10 transition-all">
                                <Shield className="h-5 w-5 text-gray-300" />
                            </button>
                        </div>
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-green-500/35 bg-green-500/15 px-4 py-3 font-medium text-green-300 transition-colors hover:bg-green-500/25"
                        >
                            <MessageCircle className="h-5 w-5" />
                            WhatsApp Inquiry
                        </a>
                    </div>

                    <p className="text-gray-400 mb-8 leading-relaxed whitespace-pre-line">
                        {product.description}
                    </p>

                    {/* Product details (attributes by category) — one box, categories divided inside */}
                    {(() => {
                        const groups: { category: string; attributes: { name?: string; value: string }[] }[] =
                            product.attributeGroups?.length
                                ? product.attributeGroups
                                : product.attributes?.length
                                    ? [{ category: "General", attributes: product.attributes }]
                                    : [];
                        if (groups.length === 0) return null;
                        const isExpanded = (idx: number) => expandedGroups[idx] !== false;
                        const setExpanded = (idx: number, open: boolean) => {
                            setExpandedGroups((prev) => ({ ...prev, [idx]: open }));
                        };
                        return (
                            <div className="mb-8">
                                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 text-primary" /> Product details
                                </h3>
                                <div className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
                                    {groups.map((group, idx) => (
                                        <div key={idx}>
                                            <button
                                                type="button"
                                                onClick={() => setExpanded(idx, !isExpanded(idx))}
                                                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left bg-white/10 hover:bg-white/15 transition-colors"
                                            >
                                                <span className="font-semibold text-white uppercase tracking-wide">
                                                    {group.category}
                                                </span>
                                                <span className="text-white/80 shrink-0">
                                                    {isExpanded(idx) ? (
                                                        <ChevronDown className="h-5 w-5" />
                                                    ) : (
                                                        <ChevronRight className="h-5 w-5" />
                                                    )}
                                                </span>
                                            </button>
                                            <motion.div
                                                initial={false}
                                                animate={{
                                                    height: isExpanded(idx) ? "auto" : 0,
                                                    opacity: isExpanded(idx) ? 1 : 0,
                                                }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-4 py-4 border-t border-white/10">
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                                        {group.attributes.map((attr, i) => (
                                                            <div key={i}>
                                                                {attr.name ? (
                                                                    <>
                                                                        <span className="block text-gray-500 text-xs uppercase tracking-wider">{attr.name}</span>
                                                                        <span className="text-gray-300">{attr.value}</span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-gray-300">{attr.value}</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                            {idx < groups.length - 1 && (
                                                <div className="border-b border-white/10" aria-hidden />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </motion.div>
            </div>
        </div>
    );
}
