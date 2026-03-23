"use client";

import Link from "next/link";
import { MessageCircle, ShoppingCart } from "lucide-react";
import { Product } from "@/hooks/useProducts";
import { buildProductWhatsAppUrl } from "@/lib/whatsapp";

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
    const productPath = `/product/${product.slug || product._id}`;
    const whatsappUrl = buildProductWhatsAppUrl({
        productTitle: product.title,
        productPath,
    });
    const colorVariants = product.colorVariants ?? [];
    const colorNamesFromLegacyVariants = (product.variants ?? [])
        .map((variant) => variant.attributes?.find((a) => (a.name ?? "").toLowerCase() === "color")?.value)
        .filter((value): value is string => Boolean(value && value.trim()));
    const colorLabels = colorVariants.length > 0
        ? colorVariants.map((variant) => variant.name)
        : colorNamesFromLegacyVariants;

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-[#5E5E5E]/30 bg-[#1a1a1a]/90 transition-colors hover:border-[#D12B28]/40 hover:bg-[#242424]/90">
            <div className="aspect-square relative overflow-hidden bg-[#121212]/80">
                <img
                    src={product.images?.[0] || "/placeholder.svg"}
                    alt={product.title}
                    className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-300"
                />
                <button
                    className="absolute bottom-4 right-4 p-3 rounded-full bg-[#D12B28] text-[#F1F1F1] shadow-lg shadow-[#D12B28]/25 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 translate-y-4 hover:bg-[#E53A36]"
                    title="Add to Cart"
                >
                    <ShoppingCart className="h-5 w-5" />
                </button>
            </div>

            <div className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-[#8E8E8E] mb-1">
                            {typeof product.brand === 'object' && product.brand !== null
                                ? (product.brand as any).name
                                : product.brand}
                        </p>
                        <h3 className="font-medium text-[#F1F1F1] line-clamp-2 min-h-[3rem]">
                            <Link href={`/product/${product.slug || product._id}`} onClick={onNavigateToProduct}>
                                <span aria-hidden="true" className="absolute inset-0" />
                                {product.title}
                            </Link>
                        </h3>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                    <p className="shrink-0 whitespace-nowrap text-lg font-bold leading-none text-[#F1F1F1]">
                        LKR {product.price.toLocaleString()}
                    </p>
                    {showOrderNowButton ? (
                        <Link
                            href={productPath}
                            onClick={onNavigateToProduct}
                            className="relative z-10 inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-[#D12B28] px-4 py-2 text-xs font-semibold text-[#F1F1F1] transition-colors hover:bg-[#E53A36]"
                        >
                            Order Now
                        </Link>
                    ) : null}
                    {showWhatsAppButton ? (
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ask on WhatsApp about ${product.title}`}
                            title="WhatsApp Inquiry"
                            className="relative z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-500/30 bg-green-500/15 text-green-300 transition-colors hover:bg-green-500/25"
                        >
                            <MessageCircle className="h-4 w-4" />
                        </a>
                    ) : null}
                </div>
                {(colorVariants.length > 0 || colorLabels.length > 0 || product.warranty) && (
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
                        {product.warranty && (
                            <p className="text-[11px] text-[#8E8E8E]">Warranty: {product.warranty}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
