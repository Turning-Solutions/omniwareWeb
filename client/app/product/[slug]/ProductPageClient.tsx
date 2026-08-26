"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, Check, AlertCircle, Clock, Package, ArrowLeft, X } from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { useRouter } from "next/navigation";

import ProductCard from "@/components/ProductCard";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import { renderRichText } from "@/lib/richText";
import { getCombinedWarrantyLabel, getWarrantyBreakdownLabel, hasExtendedWarranty } from "@/lib/warranty";
import LoadingAnimation from "@/components/LoadingAnimation";
import WhatsAppLogo from "@/components/WhatsAppLogo";
import FlowSectionHeader from "@/components/FlowSectionHeader";

interface ProductVariant {
    sku?: string;
    price?: number;
    stock?: { qty?: number };
    attributes?: { name?: string; value: string }[];
}

interface ProductColorVariant {
    name: string;
    hex?: string;
    image?: string;
    sku?: string;
    price?: number;
    stock?: { qty?: number };
}

const formatSpecificationLabel = (label?: string) => {
    if (!label) return "";
    return label.replaceAll("_", " ").trim();
};

function ProductPageInner({ slug }: { slug: string }) {
    const router = useRouter();
    const { data: product, isLoading: loading, error } = useProduct(slug);
    const primaryCategoryId = product?.categoryIds?.[0]?._id;
    const primaryCategoryName = product?.categoryIds?.[0]?.name;
    const { data: sameCategoryData, isLoading: loadingSameCategory } = useProducts({
        category: primaryCategoryId,
        limit: 12,
        includeFacets: false,
        enabled: Boolean(primaryCategoryId),
    });
    const sameCategoryProducts = useMemo(() => {
        const currentProductId = product?._id;
        const candidates = (sameCategoryData?.products ?? []).filter((item) => item._id !== currentProductId);
        const shuffled = [...candidates];
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const randomIndex = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
        }
        return shuffled.slice(0, 4);
    }, [product?._id, sameCategoryData?.products]);

    // Local state for image and variants (only when product loads)
    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedVariant, setSelectedVariant] = useState<ProductVariant | ProductColorVariant | null>(null);
    const { addToCart } = useCart();
    const [qty, setQty] = useState(1);
    const [cartToastVisible, setCartToastVisible] = useState(false);

    // Reset local state when product changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedImage(0);
        setSelectedVariant(null);
        setQty(1);
    }, [product]);

    useEffect(() => {
        if (!cartToastVisible) return undefined;
        const id = window.setTimeout(() => setCartToastVisible(false), 4000);
        return () => window.clearTimeout(id);
    }, [cartToastVisible]);

    const shellDecor = (
        <>
            <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -right-40 top-[18%] h-[min(80vw,28rem)] w-[min(80vw,28rem)] rounded-full bg-[#D12B28]/[0.04] blur-[100px]"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute -left-32 top-[55%] h-72 w-72 rounded-full bg-[#D12B28]/[0.035] blur-[90px]"
                aria-hidden
            />
        </>
    );

    if (error) {
        return (
            <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] text-[#F1F1F1]">
                <div className="relative flex flex-1 flex-col bg-[linear-gradient(180deg,#080808_0%,#0c0c0c_18%,#101010_45%,#0d0d0d_72%,#0a0a0a_100%)] pt-24 pb-16">
                    {shellDecor}
                    <div className="mx-auto max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
                        <div className="rounded-[1.75rem] border border-white/[0.07] bg-[#0c0c0c]/85 px-6 py-16 text-center shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                            <p className="text-lg font-semibold text-[#F1F1F1]">Couldn&apos;t load this product</p>
                            <p className="mt-2 text-sm text-[#B0B0B0]">Check your connection and try again.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] text-[#F1F1F1]">
                <div className="relative flex flex-1 flex-col bg-[linear-gradient(180deg,#080808_0%,#0c0c0c_18%,#101010_45%,#0d0d0d_72%,#0a0a0a_100%)] pt-24 pb-16">
                    {shellDecor}
                    <div className="mx-auto flex w-full max-w-7xl flex-1 items-center justify-center px-4 sm:px-6 lg:px-8">
                        <LoadingAnimation size="lg" label="Loading product..." />
                    </div>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] text-[#F1F1F1]">
                <div className="relative flex flex-1 flex-col bg-[linear-gradient(180deg,#080808_0%,#0c0c0c_18%,#101010_45%,#0d0d0d_72%,#0a0a0a_100%)] pt-24 pb-16">
                    {shellDecor}
                    <div className="mx-auto max-w-7xl flex-1 px-4 sm:px-6 lg:px-8">
                        <div className="rounded-[1.75rem] border border-white/[0.07] bg-[#0c0c0c]/85 px-6 py-16 text-center shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                            <p className="text-lg font-semibold text-[#F1F1F1]">Product not found</p>
                            <p className="mt-2 text-sm text-[#B0B0B0]">This item may have been removed or the link is outdated.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const selectedColorVariant =
        selectedVariant && "name" in selectedVariant && !("attributes" in selectedVariant)
            ? selectedVariant as ProductColorVariant
            : null;

    const selectedColorImage = selectedColorVariant?.image?.trim() || "";
    const currentImage = selectedColorImage || product.images?.[selectedImage] || "";

    const effectiveDiscountAmount = product.effectiveDiscountPercent ?? product.discountPercent ?? 0;
    const applyDiscountToPrice = (price: number) =>
        effectiveDiscountAmount > 0 ? Math.max(0, Math.round(price - effectiveDiscountAmount)) : price;

    const currentOriginalPrice = selectedVariant?.price ?? product.price;
    const currentPrice = applyDiscountToPrice(currentOriginalPrice);

    const currentStock = selectedVariant?.stock?.qty ?? product.stock?.qty ?? 0;
    const availability = product.availability ?? (currentStock > 0 ? "in_stock" : "out_of_stock");

    const availabilityConfig = {
        in_stock: { label: "In Stock", className: "text-green-400", icon: Check },
        out_of_stock: { label: "Out of Stock", className: "text-red-400", icon: AlertCircle },
        pre_order: { label: "Pre-Order", className: "text-yellow-400", icon: Clock },
        coming_soon: { label: "Coming Soon", className: "text-blue-400", icon: Package },
    } as const;

    const availInfo =
        availabilityConfig[availability as keyof typeof availabilityConfig] ?? availabilityConfig.out_of_stock;
    const AvailIcon = availInfo.icon;
    const canAddToCart = availability === "in_stock" || availability === "pre_order";

    const productPath = `/product/${product.slug || product._id}`;
    const whatsappUrl = buildProductWhatsAppUrl({
        productTitle: product.title,
        productPath,
    });
    const preorderWhatsappUrl = buildProductWhatsAppUrl({
        productTitle: product.title,
        productPath,
        intent: "pre_order",
        quantity: qty,
    });

    const brandLabel =
        typeof product.brand === "object" && product.brand !== null && "name" in product.brand
            ? (product.brand as { name: string }).name
            : typeof product.brand === "string"
              ? product.brand
              : typeof product.brandId !== "string" && product.brandId?.name
                ? product.brandId.name
                : "Product";

    const headerDescription =
        product.categoryIds && product.categoryIds.length > 0
            ? product.categoryIds.map((c: { name: string }) => c.name).join(" · ")
            : undefined;

    const handleAddToCart = () => {
        const selectedLabel =
            selectedVariant && "attributes" in selectedVariant
                ? (selectedVariant.attributes ?? []).map((a) => a.value).join("/")
                : selectedVariant && "name" in selectedVariant
                  ? selectedVariant.name
                  : "";

        const itemToAdd = {
            ...product,
            price: currentPrice,
            // If variant selected, we might want to append variant info to title or id
            title: selectedVariant ? `${product.title} (${selectedLabel})` : product.title,
            _id: selectedVariant ? `${product._id}-${selectedVariant.sku ?? selectedLabel}` : product._id,
        };

        addToCart(itemToAdd, qty);
        setCartToastVisible(true);
    };

    return (
        <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[#0a0a0a] text-[#F1F1F1]">
            <div className="relative flex flex-col bg-[linear-gradient(180deg,#080808_0%,#0c0c0c_18%,#101010_45%,#0d0d0d_72%,#0a0a0a_100%)] pb-12 sm:pb-16 lg:pb-20">
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -right-40 top-[18%] h-[min(80vw,28rem)] w-[min(80vw,28rem)] rounded-full bg-[#D12B28]/[0.04] blur-[100px]"
                    aria-hidden
                />
                <div
                    className="pointer-events-none absolute -left-32 top-[55%] h-72 w-72 rounded-full bg-[#D12B28]/[0.035] blur-[90px]"
                    aria-hidden
                />

                <section className="relative pt-8 sm:pt-10 lg:pt-12">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <button
                            type="button"
                            onClick={() => router.back()}
                            className="mb-8 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-[#E8E8E8] transition-colors hover:border-[#D12B28]/35 hover:bg-[#D12B28]/10 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </button>

                        <FlowSectionHeader
                            eyebrow={brandLabel}
                            title={product.title}
                            description={headerDescription}
                            titleTag="h1"
                        />

                        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-[#0c0c0c]/85 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:p-7 lg:p-8">
                            <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_5%,rgba(209,43,40,0.65)_50%,transparent_95%)]" />
                            <div className="pointer-events-none absolute -right-28 -top-28 h-64 w-64 rounded-full bg-[#D12B28]/10 blur-3xl" aria-hidden />
                            <div className="pointer-events-none absolute -bottom-20 -left-20 h-52 w-52 rounded-full bg-[#D12B28]/6 blur-3xl" aria-hidden />

                            <div className="relative grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-12 lg:gap-14">
                {/* Image Gallery */}
                <div>
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="mb-4 flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121212]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                        {currentImage ? (
                            <div className="relative w-full h-full">
                                <Image
                                    src={currentImage}
                                    alt={product.title}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <span className="text-lg text-[#8E8E8E]">No Image Available</span>
                        )}
                    </motion.div>

                    {product.images && product.images.length > 1 && (
                        <div className="flex gap-2 cursor-pointer overflow-x-auto pb-2">
                            {product.images.map((img: string, idx: number) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedImage(idx)}
                                    className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border transition-colors ${
                                        selectedImage === idx
                                            ? "border-[#D12B28]/60 bg-[#D12B28]/10 ring-1 ring-[#D12B28]/25"
                                            : "border-white/[0.06] bg-[#161616] hover:border-white/15"
                                    }`}
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
                        <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#121212]/90 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#F1F1F1]">
                                <AlertCircle className="h-4 w-4 text-[#D12B28]" aria-hidden />
                                Specifications
                            </h3>
                            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                                {Object.entries(product.specs).map(([key, value]) => (
                                    <div key={key}>
                                        <span className="block text-[11px] font-medium uppercase tracking-wide text-[#8E8E8E]">
                                            {formatSpecificationLabel(key)}
                                        </span>
                                        <span className="text-[#D4D4D4]">{value as string}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="min-w-0">
                    {/* Categories Tags */}
                    {product.categoryIds && product.categoryIds.length > 0 && (
                        <div className="mb-6 flex flex-wrap gap-2">
                            {product.categoryIds.map((cat: any) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
                                <span
                                    key={cat._id}
                                    className="rounded-full border border-white/[0.08] bg-[#121212]/80 px-3 py-1 text-xs font-medium text-[#B0B0B0]"
                                >
                                    {cat.name}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                        <div className="flex flex-wrap items-baseline gap-3">
                            <span className="text-3xl font-bold tabular-nums text-[#F1F1F1]">
                                LKR {currentPrice.toLocaleString()}
                            </span>
                            {effectiveDiscountAmount > 0 && (
                                <span className="text-sm text-[#8E8E8E] line-through">
                                    LKR {currentOriginalPrice.toLocaleString()}
                                </span>
                            )}
                            {effectiveDiscountAmount > 0 && (
                                <span className="rounded-full border border-[#D12B28]/35 bg-[#D12B28]/15 px-2.5 py-1 text-xs font-bold text-[#F4C5C5]">
                                    Save LKR {Math.round(effectiveDiscountAmount).toLocaleString()}
                                </span>
                            )}
                        </div>
                        <span className={`flex items-center text-sm font-semibold ${availInfo.className}`}>
                            <AvailIcon className="h-4 w-4 mr-1" />
                            {availInfo.label}
                        </span>
                    </div>

                    {availability === "pre_order" && (
                        <div className="mb-6 flex gap-3 rounded-2xl border border-yellow-400/25 bg-yellow-500/[0.07] px-4 py-3 text-sm text-yellow-100/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" aria-hidden />
                            <div className="space-y-2">
                                <p>
                                    This product is fulfilled via pre-order and is usually delivered within ~72 hours after
                                    your order is confirmed.
                                </p>
                                <p>
                                    Please note that prices may change based on supplier rates and availability. We will
                                    always confirm the final price with you before proceeding.
                                </p>
                            </div>
                        </div>
                    )}

                    {(product.warranty || hasExtendedWarranty(product.extendedWarranty)) && (
                        <div className="mb-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3 text-sm font-medium text-emerald-200/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div>
                                Warranty:{" "}
                                {getCombinedWarrantyLabel(product.warranty, product.extendedWarranty) || product.warranty}
                                {hasExtendedWarranty(product.extendedWarranty) && (
                                    <span className="font-normal text-emerald-200/75">
                                        {" "}
                                        ({getWarrantyBreakdownLabel(product.warranty, product.extendedWarranty)})
                                    </span>
                                )}
                            </div>
                            {product.extendedWarranty?.description && (
                                <p className="mt-1.5 text-xs font-normal text-emerald-200/70">
                                    {product.extendedWarranty.description}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Variants Selection */}
                    {product.variants && product.variants.length > 0 && (
                        <div className="mb-8">
                            <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D12B28]/80">
                                Options
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {product.variants.map((variant: ProductVariant, idx: number) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setSelectedVariant(variant)}
                                        className={`rounded-xl border px-4 py-2.5 text-sm transition-all ${
                                            selectedVariant === variant
                                                ? "border-[#D12B28]/50 bg-[#D12B28]/12 text-[#F1F1F1] shadow-[0_0_20px_rgba(209,43,40,0.12)]"
                                                : "border-white/[0.08] bg-[#161616] text-[#A8A8A8] hover:border-[#D12B28]/25 hover:bg-[#1a1a1a]"
                                        }`}
                                    >
                                        {(variant.attributes ?? []).map((a) => a.value).join(" / ")}
                                        {variant.price != null && (
                                            <span className="ml-2 text-xs opacity-75">
                                                {effectiveDiscountAmount > 0 ? (
                                                    <>
                                                        LKR {applyDiscountToPrice(variant.price).toLocaleString()}
                                                        <span className="ml-1 opacity-60 line-through">
                                                            LKR {variant.price.toLocaleString()}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>LKR {variant.price.toLocaleString()}</>
                                                )}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {product.colorVariants && product.colorVariants.length > 0 && (
                        <div className="mb-8">
                            <h3 className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D12B28]/80">
                                Colors
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {product.colorVariants.map((color: ProductColorVariant, idx: number) => (
                                    <button
                                        key={`${color.name}-${idx}`}
                                        type="button"
                                        onClick={() => setSelectedVariant(color)}
                                        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all ${
                                            selectedVariant === color
                                                ? "border-[#D12B28]/50 bg-[#D12B28]/12 text-[#F1F1F1] shadow-[0_0_20px_rgba(209,43,40,0.12)]"
                                                : "border-white/[0.08] bg-[#161616] text-[#B0B0B0] hover:border-[#D12B28]/25 hover:bg-[#1a1a1a]"
                                        }`}
                                    >
                                        <span
                                            className="inline-block h-4 w-4 rounded-full border border-white/20"
                                            style={color.hex ? { backgroundColor: color.hex } : undefined}
                                        />
                                        <span>{color.name}</span>
                                        {color.price != null && (
                                            <span className="ml-1 text-xs opacity-75">
                                                {effectiveDiscountAmount > 0 ? (
                                                    <>
                                                        LKR {applyDiscountToPrice(color.price).toLocaleString()}
                                                        <span className="ml-1 opacity-60 line-through">
                                                            LKR {color.price.toLocaleString()}
                                                        </span>
                                                    </>
                                                ) : (
                                                    <>LKR {color.price.toLocaleString()}</>
                                                )}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-8 space-y-4">
                        <div className="flex flex-wrap gap-3 items-center">
                            {canAddToCart && (
                                <div className="flex items-center rounded-xl border border-white/[0.08] bg-[#121212]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    <button
                                        type="button"
                                        onClick={() => setQty(Math.max(1, qty - 1))}
                                        className="px-4 py-2.5 text-[#8E8E8E] transition-colors hover:text-white"
                                    >
                                        −
                                    </button>
                                    <span className="min-w-[2.5rem] text-center font-semibold tabular-nums text-[#F1F1F1]">
                                        {qty}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setQty(Math.min(currentStock || 99, qty + 1))}
                                        className="px-4 py-2.5 text-[#8E8E8E] transition-colors hover:text-white"
                                    >
                                        +
                                    </button>
                                </div>
                            )}

                            {availability === "pre_order" && canAddToCart && (
                                <button
                                    type="button"
                                    onClick={handleAddToCart}
                                    className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#161616] px-5 py-2.5 text-sm font-semibold text-[#F1F1F1] transition-colors hover:border-[#D12B28]/35 hover:bg-[#D12B28]/12"
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                    Add to cart
                                </button>
                            )}

                            {availability !== "pre_order" && (
                                <button
                                    type="button"
                                    onClick={handleAddToCart}
                                    disabled={!canAddToCart}
                                    className={`flex min-h-[3.5rem] min-w-[10rem] flex-1 items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all ${
                                        availability === "in_stock"
                                            ? "bg-[#D12B28] text-white shadow-lg shadow-[#D12B28]/25 hover:bg-[#B32522]"
                                            : "cursor-not-allowed bg-[#3a3a3a] text-[#8E8E8E]"
                                    }`}
                                >
                                    {availability === "in_stock" && (
                                        <>
                                            <ShoppingCart className="h-5 w-5" /> Add to Cart
                                        </>
                                    )}
                                    {availability === "out_of_stock" && (
                                        <>
                                            <AlertCircle className="h-5 w-5" /> Out of Stock
                                        </>
                                    )}
                                    {availability === "coming_soon" && (
                                        <>
                                            <Package className="h-5 w-5" /> Coming Soon
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        <a
                            href={availability === "pre_order" ? preorderWhatsappUrl : whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={
                                availability === "pre_order"
                                    ? "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-yellow-400/40 bg-yellow-500 px-4 py-4 text-base font-bold text-black shadow-lg shadow-yellow-500/20 transition-colors hover:bg-yellow-400"
                                    : "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-green-600/35 bg-green-400 px-4 py-3 font-medium text-black transition-colors hover:bg-green-500"
                            }
                        >
                            <WhatsAppLogo size={availability === "pre_order" ? 24 : 20} />
                            WhatsApp inquiry
                        </a>
                    </div>

                    <p className="mb-8 whitespace-pre-line text-base leading-relaxed text-[#B0B0B0]">{renderRichText(product.description)}</p>

                    {/* Product details (attributes by category) — one box, categories divided inside */}
                    {(() => {
                        const groups: { category: string; attributes: { name?: string; value: string }[] }[] = product.attributeGroups?.length
                            ? product.attributeGroups
                            : product.attributes?.length
                              ? [{ category: "General", attributes: product.attributes }]
                              : [];

                        if (groups.length === 0) return null;

                        return (
                            <div className="mb-8">
                                <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#F1F1F1]">
                                    <AlertCircle className="h-4 w-4 text-[#D12B28]" aria-hidden /> Product details
                                </h3>
                                <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121212]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                    {groups.map((group, idx) => (
                                        <div key={idx}>
                                            {groups.length > 1 && (
                                                <div className="border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5 sm:px-5">
                                                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D12B28]/85">
                                                        {formatSpecificationLabel(group.category)}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="divide-y divide-white/[0.06]">
                                                {group.attributes.map((attr, i) => (
                                                    <div
                                                        key={i}
                                                        className="grid grid-cols-1 gap-x-5 gap-y-1 px-4 py-3.5 text-sm transition-colors hover:bg-white/[0.02] sm:grid-cols-[190px_1fr] sm:px-5"
                                                    >
                                                        {attr.name ? (
                                                            <span className="font-medium text-[#8E8E8E]">
                                                                {formatSpecificationLabel(attr.name)}
                                                            </span>
                                                        ) : (
                                                            <span className="hidden sm:block" aria-hidden />
                                                        )}
                                                        <div className="whitespace-pre-line break-words leading-relaxed text-[#D4D4D4]">
                                                            {renderRichText(attr.value)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </motion.div>
                            <div className="col-span-full mt-10 border-t border-white/[0.08] pt-10 md:col-span-2">
                                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-xl font-bold tracking-tight text-[#F1F1F1] sm:text-2xl">
                                            More from this category
                                        </h2>
                                        <p className="mt-2 text-sm text-[#8E8E8E]">
                                            {primaryCategoryName
                                                ? `A few more picks from ${primaryCategoryName}.`
                                                : "Explore similar products from the same category."}
                                        </p>
                                    </div>
                                </div>

                                {loadingSameCategory ? (
                                    <div className="rounded-2xl border border-white/[0.07] bg-[#121212]/40 p-6">
                                        <LoadingAnimation size="md" label="Loading similar products..." className="h-40" />
                                    </div>
                                ) : sameCategoryProducts.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                                        {sameCategoryProducts.map((item) => (
                                            <ProductCard
                                                key={item._id}
                                                product={item}
                                                showOrderNowButton
                                                showWhatsAppButton={false}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-white/[0.07] bg-[#121212]/40 px-5 py-6 text-sm text-[#8E8E8E]">
                                        No other products are available in this category right now.
                                    </div>
                                )}
                            </div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <AnimatePresence>
                {cartToastVisible && (
                    <motion.div
                        key="cart-toast"
                        role="status"
                        aria-live="polite"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ type: "spring", stiffness: 380, damping: 28 }}
                        className="pointer-events-auto fixed bottom-6 left-1/2 z-[100] flex w-[min(100%-2rem,24rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-emerald-500/40 bg-[#1e1e1e]/95 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md"
                    >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                            <Check className="h-5 w-5 text-emerald-400" aria-hidden />
                        </span>
                        <p className="min-w-0 flex-1 text-sm font-medium leading-snug text-white">
                            Added to cart — you can keep shopping or open your cart when you’re ready.
                        </p>
                        <button
                            type="button"
                            onClick={() => setCartToastVisible(false)}
                            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
                            aria-label="Dismiss notification"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function ProductPageClient({ slug }: { slug: string }) {
    return <ProductPageInner slug={slug} />;
}
