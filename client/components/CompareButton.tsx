"use client";

import type { MouseEvent } from "react";
import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Check, GitCompareArrows } from "lucide-react";
import toast from "react-hot-toast";
import type { Product } from "@/hooks/useProducts";
import type { CategoryTreeItem } from "@/hooks/useCategoryTree";
import api from "@/lib/api";
import { resolveMainCategory } from "@/lib/productMainCategory";
import { useCompare, type CompareItem } from "@/context/CompareContext";

type CompareButtonProps = {
    product: Product;
    variant?: "card" | "page";
    className?: string;
};

export default function CompareButton({ product, variant = "card", className = "" }: CompareButtonProps) {
    const queryClient = useQueryClient();
    const { isInCompare, addToCompare, replaceCompare, removeFromCompare, compareItems } = useCompare();
    const [busy, setBusy] = useState(false);
    const selected = isInCompare(product._id);

    const buildItem = async (): Promise<CompareItem | null> => {
        let tree: CategoryTreeItem[] = [];
        try {
            tree = await queryClient.ensureQueryData<CategoryTreeItem[]>({
                queryKey: ["shop-category-tree"],
                queryFn: async () => {
                    const { data } = await api.get("/products/categories");
                    return Array.isArray(data) ? (data as CategoryTreeItem[]) : [];
                },
                staleTime: 5 * 60 * 1000,
            });
        } catch {
            // fall back to the product's own category refs
        }
        const main = resolveMainCategory(product, tree);
        if (!main) return null;
        const hasDiscount = (product.effectiveDiscountPercent ?? 0) > 0;
        return {
            _id: product._id,
            slug: product.slug,
            title: product.title,
            image: product.images?.[0],
            price: hasDiscount ? product.discountedPrice ?? product.price : product.price,
            categoryId: main.id,
            categoryName: main.name,
            categorySlug: main.slug,
        };
    };

    const handleClick = async (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (busy) return;

        if (selected) {
            removeFromCompare(product._id);
            return;
        }

        setBusy(true);
        try {
            const item = await buildItem();
            if (!item) {
                toast.error("This product can't be compared (no category).");
                return;
            }
            const result = addToCompare(item);
            if (result.ok) {
                toast.success(`Added to compare (${compareItems.length + 1})`);
                return;
            }
            toast(
                (t) => (
                    <div className="flex flex-col gap-2 text-sm">
                        <span>
                            You can only compare products from the same category. Your list has{" "}
                            <strong>{result.currentCategoryName}</strong> products.
                        </span>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className="rounded-md bg-[#D12B28] px-3 py-1 text-xs font-semibold text-white hover:bg-[#B32522]"
                                onClick={() => {
                                    replaceCompare(item);
                                    toast.dismiss(t.id);
                                    toast.success(`Started a new ${item.categoryName} comparison`);
                                }}
                            >
                                Start new comparison
                            </button>
                            <button
                                type="button"
                                className="rounded-md border border-white/15 px-3 py-1 text-xs text-[#D4D4D4] hover:bg-white/5"
                                onClick={() => toast.dismiss(t.id)}
                            >
                                Keep current
                            </button>
                        </div>
                    </div>
                ),
                { duration: 8000 }
            );
        } finally {
            setBusy(false);
        }
    };

    if (variant === "page") {
        return (
            <div className={`flex flex-wrap items-center gap-3 ${className}`}>
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={busy}
                    aria-pressed={selected}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                        selected
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/20"
                            : "border-white/[0.1] bg-[#161616] text-[#F1F1F1] hover:border-[#D12B28]/35 hover:bg-[#D12B28]/12"
                    }`}
                >
                    {selected ? <Check className="h-4 w-4" /> : <GitCompareArrows className="h-4 w-4" />}
                    {selected ? "Added to compare" : "Compare"}
                </button>
                {compareItems.length > 0 && (
                    <Link href="/compare" className="text-sm text-[#8E8E8E] underline-offset-2 hover:text-[#F1F1F1] hover:underline">
                        View comparison ({compareItems.length})
                    </Link>
                )}
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            aria-pressed={selected}
            title={selected ? "Remove from compare" : "Add to compare"}
            className={`relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors disabled:opacity-60 ${
                selected
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    : "border-white/15 bg-black/30 text-[#A8A8A8] hover:border-[#D12B28]/50 hover:text-[#F1F1F1]"
            } ${className}`}
        >
            {selected ? <Check className="h-3 w-3" /> : <GitCompareArrows className="h-3 w-3" />}
            {selected ? "Added" : "Compare"}
        </button>
    );
}
