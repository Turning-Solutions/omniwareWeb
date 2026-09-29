"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQueries } from "@tanstack/react-query";
import { Check, GitCompareArrows, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import type { Product } from "@/hooks/useProducts";
import { useCompare } from "@/context/CompareContext";
import { useCart } from "@/context/CartContext";
import { normalizeSpecKey } from "@/lib/normalizeSpecKey";
import { getCombinedWarrantyLabel } from "@/lib/warranty";
import { getBestValueIndexes, valuesDiffer, type SpecDirection } from "@/lib/compareSpecs";

type Row = {
    key: string;
    label: string;
    /** Raw values used for difference / best-value detection (one per product column). */
    values: (string | null)[];
    direction?: SpecDirection;
    /** Optional custom cell renderer; defaults to the raw value. */
    render?: (index: number) => ReactNode;
};

type Section = { title: string; rows: Row[] };

type DecoratedRow = Row & { differs: boolean; best: Set<number> };

const AVAILABILITY_LABELS: Record<string, string> = {
    in_stock: "In stock",
    out_of_stock: "Out of stock",
    pre_order: "Pre-order",
    coming_soon: "Coming soon",
};

const formatLabel = (label: string) => label.replaceAll("_", " ").trim();

function getBrandName(product: Product): string | null {
    const brand = product.brandId && typeof product.brandId === "object" ? product.brandId : product.brand;
    if (brand && typeof brand === "object") return brand.name ?? null;
    return typeof brand === "string" && brand ? brand : null;
}

function getAvailability(product: Product): string {
    const qty = product.stock?.qty ?? product.countInStock ?? 0;
    return product.availability ?? (qty > 0 ? "in_stock" : "out_of_stock");
}

function getEffectivePrice(product: Product): number {
    const hasDiscount = (product.effectiveDiscountPercent ?? 0) > 0;
    return hasDiscount ? product.discountedPrice ?? product.price : product.price;
}

function buildSections(products: Product[]): Section[] {
    const overview: Row[] = [
        {
            key: "price",
            label: "Price",
            values: products.map((p) => String(getEffectivePrice(p))),
            direction: "lower",
            render: (i) => {
                const p = products[i];
                const hasDiscount = (p.effectiveDiscountPercent ?? 0) > 0;
                return (
                    <div className="flex flex-col">
                        {hasDiscount && (
                            <span className="text-xs text-[#6a6a6a] line-through tabular-nums">
                                LKR {(p.originalPrice ?? p.price).toLocaleString()}
                            </span>
                        )}
                        <span className="font-bold tabular-nums">LKR {getEffectivePrice(p).toLocaleString()}</span>
                    </div>
                );
            },
        },
        { key: "brand", label: "Brand", values: products.map(getBrandName), direction: "none" },
        {
            key: "availability",
            label: "Availability",
            values: products.map((p) => AVAILABILITY_LABELS[getAvailability(p)] ?? getAvailability(p)),
            direction: "none",
        },
        {
            key: "warranty",
            label: "Warranty",
            values: products.map((p) => getCombinedWarrantyLabel(p.warranty, p.extendedWarranty) || p.warranty || null),
            direction: "higher",
        },
    ];

    // Key specs (filterable spec map) — union of keys, in first-seen order.
    const specKeys: string[] = [];
    const specLabels = new Map<string, string>();
    for (const p of products) {
        for (const key of Object.keys(p.specs ?? {})) {
            const norm = normalizeSpecKey(key);
            if (!specLabels.has(norm)) {
                specLabels.set(norm, key);
                specKeys.push(norm);
            }
        }
    }
    const specValue = (p: Product, norm: string): string | null => {
        for (const [k, v] of Object.entries(p.specs ?? {})) {
            if (normalizeSpecKey(k) === norm && v != null && String(v).trim()) return String(v);
        }
        return null;
    };
    const specRows: Row[] = specKeys.map((norm) => ({
        key: `spec:${norm}`,
        label: formatLabel(specLabels.get(norm) ?? norm),
        values: products.map((p) => specValue(p, norm)),
    }));

    // Detailed attribute groups — merged by group name, then attribute name.
    const groups = new Map<string, { title: string; rows: Map<string, { label: string; values: (string | null)[] }> }>();
    products.forEach((p, productIndex) => {
        const productGroups = p.attributeGroups?.length
            ? p.attributeGroups
            : p.attributes?.length
              ? [{ category: "General", attributes: p.attributes }]
              : [];
        for (const group of productGroups) {
            const groupKey = (group.category || "General").trim().toLowerCase();
            if (!groups.has(groupKey)) groups.set(groupKey, { title: formatLabel(group.category || "General"), rows: new Map() });
            const groupEntry = groups.get(groupKey)!;
            for (const attr of group.attributes ?? []) {
                if (!attr.name?.trim() || !attr.value?.trim()) continue;
                const norm = normalizeSpecKey(attr.name);
                // Already shown under key specs.
                if (specLabels.has(norm)) continue;
                if (!groupEntry.rows.has(norm)) {
                    groupEntry.rows.set(norm, { label: formatLabel(attr.name), values: products.map(() => null) });
                }
                const row = groupEntry.rows.get(norm)!;
                if (row.values[productIndex] == null) row.values[productIndex] = attr.value;
            }
        }
    });

    const sections: Section[] = [{ title: "Overview", rows: overview }];
    if (specRows.length) sections.push({ title: "Specifications", rows: specRows });
    for (const [groupKey, group] of groups) {
        const rows = Array.from(group.rows, ([norm, row]) => ({ key: `attr:${groupKey}:${norm}`, ...row }));
        if (rows.length) sections.push({ title: group.title, rows });
    }
    return sections;
}

export default function ComparePageClient() {
    const { compareItems, removeFromCompare, clearCompare } = useCompare();
    const { addToCart } = useCart();
    const [differencesOnly, setDifferencesOnly] = useState(false);

    const queries = useQueries({
        queries: compareItems.map((item) => {
            const slug = item.slug || item._id;
            return {
                queryKey: ["product", slug],
                queryFn: async () => {
                    const { data } = await api.get(`/products/${slug}`);
                    return data as Product;
                },
                staleTime: 5 * 60 * 1000,
            };
        }),
    });

    const isLoading = queries.some((q) => q.isLoading);
    const dataKey = queries.map((q) => q.dataUpdatedAt).join(",");
    // Only products that actually loaded get a column, so header and spec cells stay aligned.
    const columns = useMemo(
        () =>
            compareItems
                .map((item, i) => ({ item, product: queries[i]?.data }))
                .filter((c): c is { item: (typeof compareItems)[number]; product: Product } => Boolean(c.product)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [compareItems, dataKey]
    );
    const products = useMemo(() => columns.map((c) => c.product), [columns]);

    // Drop products that no longer exist (deleted / deactivated).
    const failedIds = compareItems.filter((_, i) => queries[i]?.isError).map((item) => item._id).join(",");
    useEffect(() => {
        if (!failedIds) return;
        failedIds.split(",").forEach(removeFromCompare);
    }, [failedIds, removeFromCompare]);

    const sections = useMemo(() => buildSections(products), [products]);

    const decoratedSections = useMemo(
        () =>
            sections
                .map((section) => ({
                    ...section,
                    rows: section.rows
                        .filter((row) => row.values.some((v) => v != null && v !== ""))
                        .map((row) => ({
                            ...row,
                            differs: valuesDiffer(row.values),
                            best: getBestValueIndexes(row.label, row.values, row.direction),
                        }))
                        .filter((row) => !differencesOnly || row.differs),
                }))
                .filter((section) => section.rows.length > 0),
        [sections, differencesOnly]
    );

    const differenceCount = useMemo(
        () => sections.reduce((n, s) => n + s.rows.filter((r) => valuesDiffer(r.values)).length, 0),
        [sections]
    );

    const categoryName = compareItems[0]?.categoryName;
    const categorySlug = compareItems[0]?.categorySlug;
    const addMoreHref = categorySlug ? `/shop-all/${categorySlug}` : "/shop";

    if (compareItems.length === 0) {
        return (
            <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center">
                <GitCompareArrows className="mb-4 h-12 w-12 text-[#D12B28]" />
                <h1 className="text-2xl font-bold text-[#F1F1F1]">No products to compare</h1>
                <p className="mt-2 text-[#8E8E8E]">
                    Use the <strong>Compare</strong> button on products in the shop to add them here.
                </p>
                <Link
                    href="/shop"
                    className="mt-6 rounded-xl bg-[#D12B28] px-6 py-3 font-semibold text-white hover:bg-[#B32522]"
                >
                    Browse products
                </Link>
            </div>
        );
    }

    const colCount = columns.length;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#F1F1F1] sm:text-3xl">Product Comparison</h1>
                    <p className="mt-1 text-sm text-[#8E8E8E]">
                        {categoryName ? `${categoryName} · ` : ""}
                        {colCount} product{colCount === 1 ? "" : "s"}
                        {!isLoading && colCount > 1 ? ` · ${differenceCount} difference${differenceCount === 1 ? "" : "s"}` : ""}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-sm text-[#D4D4D4]">
                        <input
                            type="checkbox"
                            checked={differencesOnly}
                            onChange={(e) => setDifferencesOnly(e.target.checked)}
                            className="h-4 w-4 accent-[#D12B28]"
                        />
                        Show differences only
                    </label>
                    <Link
                        href={addMoreHref}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-sm text-[#D4D4D4] hover:border-white/20 hover:text-white"
                    >
                        <Plus className="h-4 w-4" /> Add products
                    </Link>
                    <button
                        type="button"
                        onClick={clearCompare}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#161616] px-3 py-2 text-sm text-[#D4D4D4] hover:border-[#D12B28]/40 hover:text-white"
                    >
                        <Trash2 className="h-4 w-4" /> Clear all
                    </button>
                </div>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-[#8E8E8E]">
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-sm border border-emerald-500/50 bg-emerald-500/20" />
                    Better spec
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                    Values differ
                </span>
                {compareItems.length < 2 && <span className="text-amber-300">Add at least one more product to compare.</span>}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#121212]">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="align-top">
                            <th className="sticky left-0 z-20 w-32 min-w-[8rem] border-b border-r border-white/[0.08] bg-[#161616] p-3 text-left text-xs font-semibold uppercase tracking-wide text-[#8E8E8E] sm:w-52 sm:min-w-[13rem]">
                                Product
                            </th>
                            {columns.map(({ item, product }) => {
                                const availability = getAvailability(product);
                                const canAddToCart = availability === "in_stock" || availability === "pre_order";
                                return (
                                    <th
                                        key={item._id}
                                        className="min-w-[13rem] border-b border-white/[0.08] p-3 text-left font-normal sm:min-w-[15rem]"
                                    >
                                        <div className="relative flex flex-col gap-2">
                                            <button
                                                type="button"
                                                onClick={() => removeFromCompare(item._id)}
                                                className="absolute right-0 top-0 z-10 rounded-full bg-black/60 p-1 text-[#8E8E8E] hover:bg-[#D12B28] hover:text-white"
                                                aria-label={`Remove ${item.title} from comparison`}
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <Link
                                                href={`/product/${item.slug || item._id}`}
                                                className="relative mx-auto block aspect-square w-full max-w-[10rem] overflow-hidden rounded-lg bg-[#0e0e0e]"
                                            >
                                                <Image
                                                    src={product.images?.[0] || item.image || "/placeholder.svg"}
                                                    alt={item.title}
                                                    fill
                                                    sizes="160px"
                                                    className="object-cover"
                                                />
                                            </Link>
                                            <Link
                                                href={`/product/${item.slug || item._id}`}
                                                className="line-clamp-3 text-sm font-semibold leading-snug text-[#E6E6E6] hover:text-white"
                                            >
                                                {product.title}
                                            </Link>
                                            <div className="text-sm font-bold tabular-nums text-[#F1F1F1]">
                                                LKR {getEffectivePrice(product).toLocaleString()}
                                            </div>
                                            <button
                                                type="button"
                                                disabled={!canAddToCart}
                                                onClick={() => {
                                                    addToCart({ ...product, price: getEffectivePrice(product), availability }, 1);
                                                    toast.success("Added to cart");
                                                }}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#D12B28] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#B32522] disabled:cursor-not-allowed disabled:bg-[#3a3a3a] disabled:text-[#8E8E8E]"
                                            >
                                                <ShoppingCart className="h-3.5 w-3.5" />
                                                {canAddToCart ? "Add to cart" : AVAILABILITY_LABELS[availability] ?? "Unavailable"}
                                            </button>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={Math.max(colCount, 1) + 1} className="p-8 text-center text-[#8E8E8E]">
                                    Loading specifications…
                                </td>
                            </tr>
                        ) : (
                            decoratedSections.map((section) => (
                                <SectionRows key={section.title} section={section} colCount={colCount} />
                            ))
                        )}
                        {!isLoading && differencesOnly && decoratedSections.length === 0 && (
                            <tr>
                                <td colSpan={colCount + 1} className="p-8 text-center text-[#8E8E8E]">
                                    These products have identical specifications.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SectionRows({
    section,
    colCount,
}: {
    section: { title: string; rows: DecoratedRow[] };
    colCount: number;
}) {
    return (
        <>
            <tr>
                <td className="sticky left-0 z-10 border-b border-white/[0.08] bg-[#1a1a1a] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D12B28]/90 sm:px-4">
                    {section.title}
                </td>
                <td colSpan={colCount} className="border-b border-white/[0.08] bg-[#1a1a1a]" />
            </tr>
            {section.rows.map((row) => (
                <tr key={row.key} className="group align-top hover:bg-white/[0.02]">
                    <th
                        scope="row"
                        className="sticky left-0 z-10 border-b border-r border-white/[0.06] bg-[#141414] px-3 py-3 text-left text-xs font-medium text-[#8E8E8E] group-hover:bg-[#181818] sm:px-4 sm:text-sm"
                    >
                        <span className="inline-flex items-start gap-1.5">
                            {row.differs && colCount > 1 && (
                                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Values differ" />
                            )}
                            {row.label}
                        </span>
                    </th>
                    {row.values.map((value, i) => {
                        const isBest = row.best.has(i);
                        return (
                            <td
                                key={i}
                                className={`border-b border-white/[0.06] px-3 py-3 whitespace-pre-line break-words sm:px-4 ${
                                    isBest
                                        ? "bg-emerald-500/10 font-semibold text-emerald-300"
                                        : row.differs
                                          ? "text-[#E6E6E6]"
                                          : "text-[#A8A8A8]"
                                }`}
                            >
                                <div className="flex items-start gap-1.5">
                                    {isBest && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Better" />}
                                    <div className="min-w-0">
                                        {value == null || value === "" ? (
                                            <span className="text-[#5E5E5E]">—</span>
                                        ) : row.render ? (
                                            row.render(i)
                                        ) : (
                                            value
                                        )}
                                    </div>
                                </div>
                            </td>
                        );
                    })}
                </tr>
            ))}
        </>
    );
}
