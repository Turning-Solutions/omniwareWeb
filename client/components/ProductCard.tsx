"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ShoppingCart, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Product } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";
import WhatsAppLogo from "@/components/WhatsAppLogo";

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
    const productPath = `/product/${product.slug || product._id}`;
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
    const effectiveDiscountPercent = product.effectiveDiscountPercent ?? product.discountPercent ?? null;
    const originalPrice = product.originalPrice ?? product.price;
    const discountedPrice = product.discountedPrice ?? product.price;
    const colorNamesFromLegacyVariants = (product.variants ?? [])
        .map((variant) => variant.attributes?.find((a) => (a.name ?? "").toLowerCase() === "color")?.value)
        .filter((value): value is string => Boolean(value && value.trim()));
    const colorLabels = colorVariants.length > 0
        ? colorVariants.map((variant) => variant.name)
        : colorNamesFromLegacyVariants;

    const cartPrice =
        effectiveDiscountPercent != null && effectiveDiscountPercent > 0 ? discountedPrice : product.price;
    const canAddToCart = availability === "in_stock" || availability === "pre_order";

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
        <div className="group relative min-w-0 overflow-hidden rounded-2xl border border-[#5E5E5E]/30 bg-[#1a1a1a] shadow-sm transition-[transform,box-shadow,border-color,ring-width,ring-color] duration-500 ease-in-out hover:-translate-y-1.5 hover:border-[#D12B28]/55 hover:shadow-[0_22px_48px_-14px_rgba(209,43,40,0.42)] hover:ring-1 hover:ring-[#D12B28]/35">
            <div className="relative z-10 aspect-square overflow-hidden bg-[#121212]/80">
                {effectiveDiscountPercent != null && effectiveDiscountPercent > 0 && (
                    <div className="absolute top-3 right-3 z-10 rounded-full border border-[#D12B28]/35 bg-[#D12B28]/20 px-3 py-1 text-[10px] font-semibold text-[#F1F1F1] shadow-sm">
                        Discount {effectiveDiscountPercent}%
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
                <img
                    src={product.images?.[0] || "/placeholder.svg"}
                    alt={product.title}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out will-change-transform group-hover:scale-[1.09] group-hover:brightness-[1.06]"
                />
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
                    className="pointer-events-auto absolute bottom-4 right-4 z-20 rounded-full bg-[#D12B28] p-3 text-[#F1F1F1] shadow-lg shadow-[#D12B28]/25 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 translate-y-4 hover:bg-[#E53A36] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[#5c5c5c] disabled:opacity-60 disabled:shadow-none hover:disabled:bg-[#5c5c5c]"
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
                        <h3 className="text-[14px] font-semibold leading-snug text-[#C8C8C8] transition-colors duration-500 ease-in-out group-hover:text-[#E6E6E6] sm:text-[15px]">
                            <Link
                                href={`/product/${product.slug || product._id}`}
                                onClick={onNavigateToProduct}
                                className="line-clamp-2 min-w-0 max-w-full break-words text-left"
                            >
                                <span aria-hidden="true" className="absolute inset-0 z-0" />
                                {product.title}
                            </Link>
                        </h3>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-2 border-t border-white/[0.06] pt-3">
                    {effectiveDiscountPercent != null && effectiveDiscountPercent > 0 ? (
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
                                    aria-label={`Inquiry now on WhatsApp about ${product.title}`}
                                    className={shopPreOrderButtonClass}
                                >
                                    <WhatsAppLogo size={14} />
                                    <span className="group-hover:hidden">Pre-order</span>
                                    <span className="hidden group-hover:inline">Inquiry now</span>
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
                                aria-label={`Inquiry now on WhatsApp about ${product.title}`}
                                title="Inquiry now"
                                className="relative z-10 inline-flex w-full min-w-0 justify-center items-center gap-1.5 rounded-full border border-yellow-500/50 bg-yellow-400 px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-yellow-300"
                            >
                                <WhatsAppLogo size={16} />
                                <span>Inquiry now</span>
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
