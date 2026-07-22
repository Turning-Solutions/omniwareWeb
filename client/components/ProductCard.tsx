"use client";

import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Product } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import WhatsAppLogo from "@/components/WhatsAppLogo";
import { usePrefetchProduct } from "@/hooks/usePrefetch";

type ProductCardProps = {
    product: Product;
    showWhatsAppButton?: boolean;
    showOrderNowButton?: boolean;
    onNavigateToProduct?: () => void;
};

export default function ProductCard({
    product,
    showWhatsAppButton = true,
    showOrderNowButton = false,
    onNavigateToProduct,
}: ProductCardProps) {
    const { addToCart } = useCart();
    const productSlug = product.slug || product._id;
    const productPath = `/product/${productSlug}`;
    const { prefetch } = usePrefetchProduct(productSlug);
    const whatsappUrl = buildProductWhatsAppUrl({
        productTitle: product.title,
        productPath,
    });
    const stockQty = product.stock?.qty ?? product.countInStock ?? 0;
    const availability =
        product.availability ?? (stockQty > 0 ? "in_stock" : "out_of_stock");
    const shopInStockButtonClass =
        "relative z-10 inline-flex w-full min-w-0 justify-center items-center gap-1.5 rounded-full border border-transparent bg-[#D12B28] px-3 py-2 text-xs font-semibold text-[#F1F1F1] transition-colors hover:bg-[#B32522] group-hover:border-emerald-500/35 group-hover:bg-emerald-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-emerald-600/25 group-hover:hover:bg-emerald-500";
    const shopPreOrderButtonClass =
        "relative z-10 inline-flex w-full min-w-0 justify-center items-center gap-1.5 rounded-full border border-transparent bg-[#D12B28] px-3 py-2 text-xs font-semibold text-[#F1F1F1] transition-colors hover:bg-[#B32522] group-hover:border-yellow-400/45 group-hover:bg-yellow-400 group-hover:text-[#1a1a1a] group-hover:shadow-lg group-hover:shadow-yellow-500/25 group-hover:hover:bg-yellow-300";
    const colorVariants = product.colorVariants ?? [];
    const effectiveDiscountAmount = product.effectiveDiscountPercent ?? product.discountPercent ?? null;
    const originalPrice = product.originalPrice ?? product.price;
    const discountedPrice = product.discountedPrice ?? product.price;
    const colorNamesFromLegacyVariants = (product.variants ?? [])
        .map((variant) => variant.attributes?.find((a) => (a.name ?? "").toLowerCase() === "color")?.value)
        .filter((value): value is string => Boolean(value && value.trim()));
    const colorLabels = colorVariants.length > 0
        ? colorVariants.map((variant) => variant.name)
        : colorNamesFromLegacyVariants;

    const cartPrice =
        effectiveDiscountAmount != null && effectiveDiscountAmount > 0 ? discountedPrice : product.price;
    const canAddToCart = availability === "in_stock" || availability === "pre_order";
    const prefetchProductRoute = () => prefetch(product);

    const mainImage = product.images?.[0] || "/placeholder.svg";
    const hoverImages = Array.from(
        new Set(
            [mainImage, ...colorVariants.map((variant) => variant.image).filter((img): img is string => Boolean(img))]
        )
    );
    const hasHoverImages = hoverImages.length > 1;
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const hoverIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (hoverIntervalRef.current) clearInterval(hoverIntervalRef.current);
        };
    }, []);

    const startImageCycle = () => {
        if (!hasHoverImages || hoverIntervalRef.current) return;
        // Index 0 is the default image, index 1 is the first color (often a duplicate of
        // the default photo) — skip straight to index 2 so the initial hover shows a
        // visibly different image; the first color still appears later in the loop.
        const initialSkip = hoverImages.length > 2 ? 2 : 1;
        setActiveImageIndex((prev) => (prev + initialSkip) % hoverImages.length);
        hoverIntervalRef.current = setInterval(() => {
            setActiveImageIndex((prev) => (prev + 1) % hoverImages.length);
        }, 1100);
    };

    const stopImageCycle = () => {
        if (hoverIntervalRef.current) {
            clearInterval(hoverIntervalRef.current);
            hoverIntervalRef.current = null;
        }
        setActiveImageIndex(0);
    };

    // Hard clamp the title to 2 lines so cards in a grid keep a consistent height,
    // even if Tailwind's `line-clamp-*` utilities aren't active for some builds.
    const titleClampStyle = {
        display: "-webkit-box",
        overflow: "hidden",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
    } as unknown as CSSProperties;

    const handleQuickAddToCart = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        addToCart(
            {
                ...product,
                price: cartPrice,
                availability,
            },
            1
        );
        toast.success("Added to cart");
    };

    return (
        <div
            className="group relative min-w-0 overflow-hidden rounded-2xl border border-[#5E5E5E]/30 bg-[#1a1a1a] transition-[transform,border-color,ring-width,ring-color] duration-500 ease-in-out hover:-translate-y-1.5 hover:border-[#D12B28]/55 hover:ring-1 hover:ring-[#D12B28]/35"
            onMouseEnter={() => {
                prefetchProductRoute();
                startImageCycle();
            }}
            onMouseLeave={stopImageCycle}
            onFocusCapture={prefetchProductRoute}
            onTouchStart={prefetchProductRoute}
            onPointerDown={prefetchProductRoute}
        >
            <div className="relative z-10 aspect-square overflow-hidden bg-[#121212]/80">
                {effectiveDiscountAmount != null && effectiveDiscountAmount > 0 && (
                    <div className="absolute top-3 right-3 z-10 rounded-full border border-[#D12B28]/35 bg-[#D12B28]/20 px-3 py-1 text-[10px] font-semibold text-[#F1F1F1] shadow-sm">
                        Save LKR {Math.round(effectiveDiscountAmount).toLocaleString()}
                    </div>
                )}
                {product.warranty ? (
                    <div
                        className="pointer-events-none absolute left-0 top-0 z-10 h-24 w-24 overflow-hidden sm:h-[6.5rem] sm:w-[6.5rem]"
                        title={`Warranty: ${product.warranty}`}
                    >
                        <div className="absolute left-[-2.85rem] top-[1.35rem] flex w-[11rem] -rotate-45 items-center justify-center gap-1 border-y border-[#D12B28]/30 bg-gradient-to-r from-black/70 via-[#D12B28]/22 to-black/70 py-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
                            <ShieldCheck className="h-3 w-3 shrink-0 text-[#E8A8A4]" strokeWidth={2.25} aria-hidden />
                            <span className="max-w-[9rem] truncate text-center text-[9px] font-semibold uppercase tracking-wide text-[#ececec] sm:text-[10px]">
                                {product.warranty}
                            </span>
                        </div>
                    </div>
                ) : null}
                {hasHoverImages ? (
                    hoverImages.map((img, index) => (
                        <Image
                            key={img}
                            src={img}
                            alt={product.title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20rem"
                            quality={72}
                            className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out will-change-transform group-hover:scale-[1.09] group-hover:brightness-[1.06] ${
                                index === activeImageIndex ? "opacity-100" : "opacity-0"
                            }`}
                        />
                    ))
                ) : (
                    <Image
                        src={mainImage}
                        alt={product.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20rem"
                        quality={72}
                        className="h-full w-full object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.09] group-hover:brightness-[1.06]"
                    />
                )}
                <div
                    className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/35 via-black/10 to-black/20 transition-all duration-500 ease-in-out group-hover:from-black/10 group-hover:via-transparent group-hover:to-transparent"
                    aria-hidden
                />
                <Link
                    href={productPath}
                    onClick={onNavigateToProduct}
                    className="absolute inset-0 z-[5]"
                    aria-label={`View ${product.title}`}
                />
                <button
                    type="button"
                    disabled={!canAddToCart}
                    onClick={handleQuickAddToCart}
                    className="pointer-events-auto absolute bottom-4 right-4 z-20 rounded-full bg-[#D12B28] p-3 text-[#F1F1F1] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 translate-y-4 hover:bg-[#E53A36] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#5c5c5c] disabled:opacity-60 hover:disabled:bg-[#5c5c5c]"
                    title={canAddToCart ? "Add to cart" : "Not available for cart"}
                    aria-label={canAddToCart ? `Add ${product.title} to cart` : "Not available for cart"}
                >
                    <ShoppingCart className="h-5 w-5" />
                </button>
            </div>

            <div className="relative z-10 space-y-2 border-t border-transparent bg-[#1a1a1a] p-4 transition-colors duration-500 ease-in-out group-hover:border-[#D12B28]/20 group-hover:bg-[#252220]">
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <p className="mb-1 text-xs text-[#8E8E8E]">
                            {typeof product.brand === 'object' && product.brand !== null
                                ? (product.brand as any).name
                                : product.brand}
                        </p>
                        <h3 className="text-[14px] font-semibold leading-snug text-[#C8C8C8] transition-colors duration-500 ease-in-out group-hover:text-[#E6E6E6] sm:text-[15px] min-h-[2.9rem] sm:min-h-[3.1rem]">
                            <Link
                                href={`/product/${product.slug || product._id}`}
                                onClick={onNavigateToProduct}
                                className="min-w-0 max-w-full break-words text-left"
                                style={titleClampStyle}
                            >
                                <span aria-hidden="true" className="absolute inset-0 z-0" />
                                {product.title}
                            </Link>
                        </h3>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-4 border-t border-white/[0.06] pt-3">
                    {effectiveDiscountAmount != null && effectiveDiscountAmount > 0 ? (
                        <div className="min-w-0 flex flex-col items-start gap-0.5 leading-tight">
                            <span className="text-xs text-[#6a6a6a] line-through tabular-nums">
                                LKR {originalPrice.toLocaleString()}
                            </span>
                            <p className="text-lg font-extrabold leading-none tracking-tight text-[#D12B28] tabular-nums sm:text-xl">
                                LKR {discountedPrice.toLocaleString()}
                            </p>
                        </div>
                    ) : (
                        <p className="min-w-0 text-lg font-extrabold leading-none tracking-tight text-[#F1F1F1] tabular-nums sm:text-xl">
                            LKR {product.price.toLocaleString()}
                        </p>
                    )}
                    <div className="flex min-w-0 flex-col gap-2">
                        {showOrderNowButton ? (
                            availability === "in_stock" ? (
                                <Link
                                    href={productPath}
                                    onClick={onNavigateToProduct}
                                    className={shopInStockButtonClass}
                                >
                                    <span className="group-hover:hidden">In Stock</span>
                                    <span className="hidden group-hover:inline">Order now</span>
                                </Link>
                            ) : availability === "pre_order" ? (
                                <a
                                    href={whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Inquire now on WhatsApp about ${product.title}`}
                                    className={shopPreOrderButtonClass}
                                >
                                    <WhatsAppLogo size={14} />
                                    <span className="group-hover:hidden">Pre-order</span>
                                    <span className="hidden group-hover:inline">Inquire now</span>
                                </a>
                            ) : (
                                <Link
                                    href={productPath}
                                    onClick={onNavigateToProduct}
                                    className="relative z-10 inline-flex w-full min-w-0 justify-center items-center gap-1.5 rounded-full border border-[#5E5E5E]/40 bg-[#2a2a2a] px-3 py-2 text-xs font-semibold text-[#A8A8A8] transition-colors hover:border-[#5E5E5E]/55 hover:bg-[#323232] hover:text-[#F1F1F1]"
                                >
                                    {availability === "out_of_stock"
                                        ? "Out of stock"
                                        : availability === "coming_soon"
                                          ? "Coming soon"
                                          : "View"}
                                </Link>
                            )
                        ) : null}
                        {showWhatsAppButton ? (
                            <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Inquire now on WhatsApp about ${product.title}`}
                                title="Inquire now"
                                className="relative z-10 inline-flex w-full min-w-0 justify-center items-center gap-1.5 rounded-full border border-yellow-500/50 bg-yellow-400 px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-yellow-300"
                            >
                                <WhatsAppLogo size={16} />
                                <span>Inquire now</span>
                            </a>
                        ) : null}
                    </div>
                </div>
                {(colorVariants.length > 0 || colorLabels.length > 0) && (
                    <div className="pt-1 space-y-1.5">
                        {colorLabels.length > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] text-[#8E8E8E]">Colors:</span>
                                {colorVariants.length > 0 ? (
                                    colorVariants.slice(0, 5).map((color) => (
                                        <span
                                            key={`${color.name}-${color.hex ?? "nohex"}`}
                                            title={color.name}
                                            className="inline-block h-4 w-4 rounded-full border border-white/25"
                                            style={color.hex ? { backgroundColor: color.hex } : undefined}
                                        />
                                    ))
                                ) : (
                                    <span className="text-[11px] text-[#B0B0B0] line-clamp-1">
                                        {Array.from(new Set(colorLabels)).slice(0, 4).join(", ")}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
