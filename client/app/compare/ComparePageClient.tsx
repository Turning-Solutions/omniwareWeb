"use client";

import type { CSSProperties, ReactNode } from "react";
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

/** "key" = filterable spec map (shown first, emphasised); "detail" = other product attributes. */
type SectionVariant = "key" | "overview" | "detail";

type Section = { title: string; rows: Row[]; variant: SectionVariant };

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

    const sections: Section[] = [];
    if (specRows.length) sections.push({ title: "Key Specifications", rows: specRows, variant: "key" });
    sections.push({ title: "Overview", rows: overview, variant: "overview" });
    for (const [groupKey, group] of groups) {
        const rows = Array.from(group.rows, ([norm, row]) => ({ key: `attr:${groupKey}:${norm}`, ...row }));
        if (rows.length) sections.push({ title: group.title, rows, variant: "detail" });
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
    // Every block uses the same column template so product cards, spec tiles and detail rows line up.
    const gridStyle: CSSProperties = {
        gridTemplateColumns: `minmax(8.5rem, 13rem) repeat(${Math.max(colCount, 1)}, minmax(12rem, 1fr))`,
    };
    const keyRows = decoratedSections.filter((s) => s.variant === "key").flatMap((s) => s.rows);
    const detailSections = decoratedSections.filter((s) => s.variant !== "key");

    return (
        <div className="mx-auto w-full max-w-[1920px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
            {/* Page header — same eyebrow/title treatment as FlowSectionHeader */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                        Compare{categoryName ? ` · ${categoryName}` : ""}
                    </span>
                    <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight text-[#F1F1F1] sm:text-3xl lg:text-4xl">
                        Product Comparison
                    </h1>
                    <p className="mt-2 text-[13px] text-[#B0B0B0] sm:text-base">
                        {colCount} product{colCount === 1 ? "" : "s"}
                        {!isLoading && colCount > 1
                            ? ` · ${differenceCount} difference${differenceCount === 1 ? "" : "s"}`
                            : ""}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-white/[0.1] bg-[#161616] px-4 py-2 text-sm text-[#D4D4D4] transition-colors hover:border-white/20">
                        <input
                            type="checkbox"
                            checked={differencesOnly}
                            onChange={(e) => setDifferencesOnly(e.target.checked)}
                            className="h-4 w-4 accent-[#D12B28]"
                        />
                        Differences only
                    </label>
                    <Link
                        href={addMoreHref}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#161616] px-4 py-2 text-sm text-[#D4D4D4] transition-colors hover:border-[#D12B28]/40 hover:text-white"
                    >
                        <Plus className="h-4 w-4" /> Add products
                    </Link>
                    <button
                        type="button"
                        onClick={clearCompare}
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#161616] px-4 py-2 text-sm text-[#D4D4D4] transition-colors hover:border-[#D12B28]/40 hover:text-white"
                    >
                        <Trash2 className="h-4 w-4" /> Clear all
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto pb-2">
                <div className="min-w-fit space-y-10">
                    {/* Product cards */}
                    <div className="grid gap-3 sm:gap-4" style={gridStyle}>
                        <div className="sticky left-0 z-10 flex flex-col justify-end gap-3 rounded-2xl border border-white/[0.07] bg-[#121212] p-4 text-xs text-[#8E8E8E]">
                            <span className="inline-flex items-center gap-2">
                                <span className="inline-block h-3 w-3 rounded-sm border border-emerald-500/60 bg-emerald-500/20" />
                                Better spec
                            </span>
                            <span className="inline-flex items-center gap-2">
                                <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                                Values differ
                            </span>
                            {compareItems.length < 2 && (
                                <span className="text-amber-300">Add at least one more product to compare.</span>
                            )}
                        </div>
                        {columns.map(({ item, product }) => (
                            <CompareProductCard
                                key={item._id}
                                product={product}
                                href={`/product/${item.slug || item._id}`}
                                onRemove={() => removeFromCompare(item._id)}
                                onAddToCart={() => {
                                    addToCart(
                                        { ...product, price: getEffectivePrice(product), availability: getAvailability(product) },
                                        1
                                    );
                                    toast.success("Added to cart");
                                }}
                            />
                        ))}
                    </div>

                    {isLoading ? (
                        <p className="rounded-2xl border border-white/[0.07] bg-[#121212]/90 p-10 text-center text-[#8E8E8E]">
                            Loading specifications…
                        </p>
                    ) : (
                        <>
                            {/* Key specifications — tile layout, kept apart from the detail table */}
                            {keyRows.length > 0 && (
                                <section>
                                    <BlockHeading eyebrow="At a glance" title="Key Specifications" accent />
                                    <div className="space-y-2.5">
                                        {keyRows.map((row) => (
                                            <div
                                                key={row.key}
                                                className="grid items-stretch gap-3 rounded-2xl border border-white/[0.07] bg-gradient-to-r from-[#1c1716] to-[#141414] p-2.5 sm:gap-4"
                                                style={gridStyle}
                                            >
                                                <div className="sticky left-0 z-10 flex items-center gap-2 rounded-xl bg-[#1c1716] px-3 py-2">
                                                    {row.differs && colCount > 1 && (
                                                        <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Values differ" />
                                                    )}
                                                    <span className="text-sm font-semibold text-[#E6E6E6]">{row.label}</span>
                                                </div>
                                                {row.values.map((value, i) => {
                                                    const isBest = row.best.has(i);
                                                    return (
                                                        <div
                                                            key={i}
                                                            className={`relative flex min-h-[3.25rem] items-center justify-center rounded-xl border px-3 py-2.5 text-center text-sm font-semibold sm:text-[15px] ${
                                                                isBest
                                                                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                                                                    : "border-white/[0.06] bg-[#121212] text-[#E6E6E6]"
                                                            }`}
                                                        >
                                                            {isBest && (
                                                                <Check className="absolute right-2 top-2 h-3.5 w-3.5 text-emerald-400" aria-label="Better" />
                                                            )}
                                                            {value == null || value === "" ? (
                                                                <span className="font-normal text-[#5E5E5E]">—</span>
                                                            ) : (
                                                                <span className="whitespace-pre-line break-words">{value}</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Overview + other attributes — same look as the product page "Product details" band */}
                            {detailSections.length > 0 && (
                                <section>
                                    <BlockHeading eyebrow="Full breakdown" title="Product Details" />
                                    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#121212]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                        {detailSections.map((section) => (
                                            <DetailSection
                                                key={`${section.variant}:${section.title}`}
                                                section={section}
                                                colCount={colCount}
                                                gridStyle={gridStyle}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {differencesOnly && decoratedSections.length === 0 && (
                                <p className="rounded-2xl border border-white/[0.07] bg-[#121212]/90 p-10 text-center text-[#8E8E8E]">
                                    These products have identical specifications.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function BlockHeading({ eyebrow, title, accent = false }: { eyebrow: string; title: string; accent?: boolean }) {
    return (
        <div className="sticky left-0 mb-4 flex w-fit items-center gap-3">
            <span className={`h-8 w-1 rounded-full ${accent ? "bg-[#D12B28]" : "bg-white/20"}`} aria-hidden />
            <div>
                <span
                    className={`font-mono text-[10px] font-semibold uppercase tracking-[0.22em] ${
                        accent ? "text-[#D12B28]/80" : "text-[#8E8E8E]"
                    }`}
                >
                    {eyebrow}
                </span>
                <h2 className="text-lg font-bold tracking-tight text-[#F1F1F1] sm:text-xl">{title}</h2>
            </div>
        </div>
    );
}

function CompareProductCard({
    product,
    href,
    onRemove,
    onAddToCart,
}: {
    product: Product;
    href: string;
    onRemove: () => void;
    onAddToCart: () => void;
}) {
    const availability = getAvailability(product);
    const canAddToCart = availability === "in_stock" || availability === "pre_order";
    const hasDiscount = (product.effectiveDiscountPercent ?? 0) > 0;
    const brand = getBrandName(product);

    return (
        <div className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#5E5E5E]/30 bg-[#1a1a1a] transition-colors duration-300 hover:border-[#D12B28]/55">
            <button
                type="button"
                onClick={onRemove}
                className="absolute right-3 top-3 z-20 rounded-full border border-white/10 bg-black/60 p-1.5 text-[#B0B0B0] backdrop-blur transition-colors hover:border-[#D12B28] hover:bg-[#D12B28] hover:text-white"
                aria-label={`Remove ${product.title} from comparison`}
            >
                <X className="h-3.5 w-3.5" />
            </button>
            <Link href={href} className="relative block aspect-[4/3] overflow-hidden bg-[#121212]/80">
                <Image
                    src={product.images?.[0] || "/placeholder.svg"}
                    alt={product.title}
                    fill
                    sizes="(max-width: 1280px) 40vw, 20rem"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                />
            </Link>
            <div className="flex flex-1 flex-col gap-2 p-4">
                {brand && <p className="text-xs uppercase text-[#8E8E8E]">{brand}</p>}
                <Link
                    href={href}
                    className="line-clamp-2 min-h-[2.6rem] text-[14px] font-semibold leading-snug text-[#C8C8C8] transition-colors hover:text-white sm:text-[15px]"
                >
                    {product.title}
                </Link>
                <div className="mt-auto border-t border-white/[0.06] pt-3">
                    {hasDiscount && (
                        <span className="block text-xs text-[#6a6a6a] line-through tabular-nums">
                            LKR {(product.originalPrice ?? product.price).toLocaleString()}
                        </span>
                    )}
                    <p
                        className={`text-lg font-extrabold leading-none tracking-tight tabular-nums sm:text-xl ${
                            hasDiscount ? "text-[#D12B28]" : "text-[#F1F1F1]"
                        }`}
                    >
                        LKR {getEffectivePrice(product).toLocaleString()}
                    </p>
                </div>
                <button
                    type="button"
                    disabled={!canAddToCart}
                    onClick={onAddToCart}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#D12B28] px-3 py-2 text-xs font-semibold text-[#F1F1F1] transition-colors hover:bg-[#B32522] disabled:cursor-not-allowed disabled:bg-[#2a2a2a] disabled:text-[#8E8E8E]"
                >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {canAddToCart ? "Add to cart" : AVAILABILITY_LABELS[availability] ?? "Unavailable"}
                </button>
            </div>
        </div>
    );
}

function DetailSection({
    section,
    colCount,
    gridStyle,
}: {
    section: { title: string; rows: DecoratedRow[] };
    colCount: number;
    gridStyle: CSSProperties;
}) {
    return (
        <div>
            <div className="border-b border-white/[0.06] bg-white/[0.03] px-4 py-2.5 sm:px-5">
                <span className="sticky left-5 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D12B28]/85">
                    {section.title}
                </span>
            </div>
            <div className="divide-y divide-white/[0.06] border-b border-white/[0.06]">
                {section.rows.map((row) => (
                    <div
                        key={row.key}
                        className="grid gap-3 px-4 py-3 text-sm transition-colors hover:bg-white/[0.02] sm:gap-4 sm:px-5"
                        style={gridStyle}
                    >
                        <div className="sticky left-0 z-10 flex items-start gap-1.5 bg-[#121212] font-medium text-[#8E8E8E]">
                            {row.differs && colCount > 1 && (
                                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Values differ" />
                            )}
                            {row.label}
                        </div>
                        {row.values.map((value, i) => {
                            const isBest = row.best.has(i);
                            return (
                                <div
                                    key={i}
                                    className={`flex min-w-0 items-start gap-1.5 whitespace-pre-line break-words leading-relaxed ${
                                        isBest ? "font-semibold text-emerald-300" : "text-[#D4D4D4]"
                                    }`}
                                >
                                    {isBest && <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-400" aria-label="Better" />}
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
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
