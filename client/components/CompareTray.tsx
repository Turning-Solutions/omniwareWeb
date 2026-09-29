"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ArrowRight, ChevronDown, ChevronUp, GitCompareArrows, Plus, X } from "lucide-react";
import { MAX_COMPARE_ITEMS, useCompare } from "@/context/CompareContext";

/** Floating bottom bar listing the products queued for comparison (fixed 5 slots, no scrolling). */
export default function CompareTray() {
    const pathname = usePathname() ?? "";
    const { compareItems, removeFromCompare, clearCompare } = useCompare();
    const [collapsed, setCollapsed] = useState(false);

    if (compareItems.length === 0 || pathname.startsWith("/compare") || pathname.startsWith("/admin")) return null;

    const categoryName = compareItems[0]?.categoryName;
    const canCompare = compareItems.length >= 2;
    const emptySlots = Math.max(MAX_COMPARE_ITEMS - compareItems.length, 0);
    const addMoreHref = compareItems[0]?.categorySlug ? `/shop-all/${compareItems[0].categorySlug}` : "/shop";

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#141414]/95 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="mx-auto max-w-7xl px-4">
                <div className="flex items-center justify-between gap-3 py-2.5">
                    <button
                        type="button"
                        onClick={() => setCollapsed((v) => !v)}
                        className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-[#F1F1F1]"
                        aria-expanded={!collapsed}
                    >
                        <GitCompareArrows className="h-4 w-4 shrink-0 text-[#D12B28]" />
                        <span className="truncate">
                            Compare
                            {categoryName ? <span className="font-normal text-[#8E8E8E]"> · {categoryName}</span> : null}
                            <span className="ml-1.5 text-[#8E8E8E] tabular-nums">
                                {compareItems.length}/{MAX_COMPARE_ITEMS}
                            </span>
                        </span>
                        {collapsed ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={clearCompare}
                            className="rounded-lg px-3 py-2 text-xs font-medium text-[#8E8E8E] transition-colors hover:bg-white/5 hover:text-[#F1F1F1]"
                        >
                            Clear all
                        </button>
                        <Link
                            href="/compare"
                            aria-disabled={!canCompare}
                            onClick={(e) => {
                                if (!canCompare) e.preventDefault();
                            }}
                            className={`group inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                                canCompare
                                    ? "bg-gradient-to-r from-[#D12B28] to-[#E5483F] text-white shadow-lg shadow-[#D12B28]/30 hover:shadow-[#D12B28]/50 hover:brightness-110"
                                    : "cursor-not-allowed bg-[#2a2a2a] text-[#6a6a6a]"
                            }`}
                            title={canCompare ? "Compare selected products" : "Add at least 2 products to compare"}
                        >
                            <GitCompareArrows className="h-4 w-4" />
                            <span>Compare now</span>
                            {canCompare && (
                                <ArrowRight className="hidden h-4 w-4 transition-transform group-hover:translate-x-0.5 sm:block" />
                            )}
                        </Link>
                    </div>
                </div>

                {!collapsed && (
                    <div className="grid grid-cols-5 gap-2 pb-3 sm:gap-3">
                        {compareItems.map((item) => (
                            <div
                                key={item._id}
                                className="relative flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-[#1e1e1e] p-1.5 sm:p-2 sm:pr-7"
                            >
                                <div className="relative aspect-square w-full shrink-0 overflow-hidden rounded bg-[#121212] sm:h-12 sm:w-12">
                                    <Image
                                        src={item.image || "/placeholder.svg"}
                                        alt={item.title}
                                        fill
                                        sizes="(max-width: 640px) 20vw, 48px"
                                        className="object-cover"
                                    />
                                </div>
                                <div className="hidden min-w-0 sm:block">
                                    <Link
                                        href={`/product/${item.slug || item._id}`}
                                        className="line-clamp-2 text-xs leading-snug text-[#D4D4D4] hover:text-white"
                                        title={item.title}
                                    >
                                        {item.title}
                                    </Link>
                                    <p className="mt-0.5 text-xs font-semibold tabular-nums text-[#F1F1F1]">
                                        LKR {item.price.toLocaleString()}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeFromCompare(item._id)}
                                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-[#8E8E8E] hover:bg-[#D12B28] hover:text-white sm:bg-transparent"
                                    aria-label={`Remove ${item.title} from compare`}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                        {Array.from({ length: emptySlots }, (_, i) => (
                            <Link
                                key={`empty-${i}`}
                                href={addMoreHref}
                                className="flex min-w-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 p-2 text-xs text-[#6a6a6a] transition-colors hover:border-[#D12B28]/50 hover:text-[#D4D4D4]"
                            >
                                <Plus className="h-4 w-4 shrink-0" />
                                <span className="hidden truncate sm:inline">Add product</span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
