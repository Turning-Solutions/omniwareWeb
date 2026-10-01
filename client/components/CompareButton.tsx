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
import { MAX_COMPARE_ITEMS, useCompare, type CompareItem } from "@/context/CompareContext";

type CompareButtonProps = {
    product: Product;
    variant?: "card" | "icon" | "page";
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
                toast.success(`Added to compare (${compareItems.length + 1}/${MAX_COMPARE_ITEMS})`);
                return;
            }
            if (result.reason === "limit") {
                toast.error(`You can compare up to ${MAX_COMPARE_ITEMS} products. Remove one to add another.`);
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
            <div className={`flex flex-col gap-2 sm:flex-row ${className}`}>
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={busy}
                    aria-pressed={selected}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition-colors disabled:opacity-60 ${
                        selected
                            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                            : "border-[#D12B28]/60 bg-[#D12B28]/10 text-[#F1F1F1] hover:border-[#D12B28] hover:bg-[#D12B28]/20"
                    }`}
                >
                    {selected ? <Check className="h-5 w-5" /> : <GitCompareArrows className="h-5 w-5 text-[#D12B28]" />}
                    {selected ? "Added to compare" : "Add to compare"}
                </button>
                {compareItems.length > 0 && (
                    <Link
                        href="/compare"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-[#161616] px-4 py-3 text-sm font-semibold text-[#D4D4D4] transition-colors hover:border-white/25 hover:text-white"
                    >
                        View comparison
                        <span className="rounded-full bg-[#D12B28] px-2 py-0.5 text-xs text-white tabular-nums">
                            {compareItems.length}/{MAX_COMPARE_ITEMS}
                        </span>
                    </Link>
                )}
            </div>
        );
    }

    if (variant === "icon") {
        return (
            <button
                type="button"
                onClick={handleClick}
                disabled={busy}
                aria-pressed={selected}
                title={selected ? "Remove from compare" : "Add to compare"}
                aria-label={selected ? `Remove ${product.title} from compare` : `Add ${product.title} to compare`}
                className={`rounded-full px-4 py-3 text-sm font-semibold leading-5 shadow-lg transition-all duration-300 disabled:opacity-60 ${
                    selected
                        ? "translate-y-0 bg-emerald-600 text-white opacity-100 hover:bg-emerald-500"
                        : "translate-y-4 bg-[#D12B28] text-[#F1F1F1] opacity-0 hover:bg-[#E53A36] group-hover:translate-y-0 group-hover:opacity-100"
                } ${className}`}
            >
                {selected ? "Added to compare" : "Compare"}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={busy}
            aria-pressed={selected}
            title={selected ? "Remove from compare" : "Add to compare"}
            className={`relative z-10 inline-flex w-full min-w-0 items-center justify-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                selected
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                    : "border-[#D12B28]/60 bg-transparent text-[#F1F1F1] hover:border-[#D12B28] hover:bg-[#D12B28]/15"
            } ${className}`}
        >
            {selected ? <Check className="h-3.5 w-3.5" /> : <GitCompareArrows className="h-3.5 w-3.5" />}
            {selected ? "Added to compare" : "Compare"}
        </button>
    );
}
