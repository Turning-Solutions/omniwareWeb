"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, GitCompareArrows, X } from "lucide-react";
import { useCompare } from "@/context/CompareContext";

/** Floating bottom bar listing the products queued for comparison. */
export default function CompareTray() {
    const pathname = usePathname() ?? "";
    const { compareItems, removeFromCompare, clearCompare } = useCompare();
    const [collapsed, setCollapsed] = useState(false);

    if (compareItems.length === 0 || pathname.startsWith("/compare") || pathname.startsWith("/admin")) return null;

    const categoryName = compareItems[0]?.categoryName;
    const canCompare = compareItems.length >= 2;

    return (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#141414]/95 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
            <div className="mx-auto max-w-7xl px-4">
                <div className="flex items-center justify-between gap-3 py-2">
                    <button
                        type="button"
                        onClick={() => setCollapsed((v) => !v)}
                        className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-[#F1F1F1]"
                        aria-expanded={!collapsed}
                    >
                        <GitCompareArrows className="h-4 w-4 shrink-0 text-[#D12B28]" />
                        <span className="truncate">
                            Compare {categoryName ? <span className="text-[#8E8E8E]">· {categoryName}</span> : null} ({compareItems.length})
                        </span>
                        {collapsed ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={clearCompare}
                            className="rounded-lg px-3 py-1.5 text-xs text-[#8E8E8E] transition-colors hover:bg-white/5 hover:text-[#F1F1F1]"
                        >
                            Clear
                        </button>
                        <Link
                            href="/compare"
                            aria-disabled={!canCompare}
                            onClick={(e) => {
                                if (!canCompare) e.preventDefault();
                            }}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                                canCompare
                                    ? "bg-[#D12B28] text-white hover:bg-[#B32522]"
                                    : "cursor-not-allowed bg-[#3a3a3a] text-[#8E8E8E]"
                            }`}
                            title={canCompare ? "Compare selected products" : "Add at least 2 products to compare"}
                        >
                            Compare now
                        </Link>
                    </div>
                </div>

                {!collapsed && (
                    <div className="flex gap-3 overflow-x-auto pb-3">
                        {compareItems.map((item) => (
                            <div
                                key={item._id}
                                className="relative flex w-56 shrink-0 items-center gap-3 rounded-lg border border-white/10 bg-[#1e1e1e] p-2 pr-7"
                            >
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded bg-[#121212]">
                                    <Image
                                        src={item.image || "/placeholder.svg"}
                                        alt={item.title}
                                        fill
                                        sizes="48px"
                                        className="object-cover"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <Link
                                        href={`/product/${item.slug || item._id}`}
                                        className="line-clamp-2 text-xs leading-snug text-[#D4D4D4] hover:text-white"
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
                                    className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-[#8E8E8E] hover:bg-white/10 hover:text-white"
                                    aria-label={`Remove ${item.title} from compare`}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                        {compareItems.length < 2 && (
                            <div className="flex w-56 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/20 p-2 text-center text-xs text-[#8E8E8E]">
                                Add another {categoryName ?? ""} product to compare
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
