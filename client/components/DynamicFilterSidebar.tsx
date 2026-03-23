"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { ChevronDown, Search, X, SlidersHorizontal, Check } from "lucide-react";
import { Facets } from "@/hooks/useProducts";

interface DynamicFilterSidebarProps {
    facets: Facets;
    filters: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    setFilters: (filters: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    isOpen: boolean;
    onClose: () => void;
}

/** Count active filters (excluding search/sort/page) for badge and toolbar */
export function countActiveFilters(filters: Record<string, unknown>): number {
    let n = 0;
    if (filters.category) n += 1;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) n += 1;
    if (filters.brand && String(filters.brand).trim()) n += 1;
    if (filters.spec && typeof filters.spec === "object") {
        n += Object.keys(filters.spec).length;
    }
    return n;
}

function formatPriceLkr(value: number): string {
    return `LKR ${value.toLocaleString()}`;
}

function formatFilterLabel(value: string): string {
    return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function orderOptionsSelectedFirst<T extends { value: string }>(
    items: T[],
    isSelected: (value: string) => boolean
): T[] {
    const selected: T[] = [];
    const unselected: T[] = [];

    items.forEach((item) => {
        if (isSelected(item.value)) selected.push(item);
        else unselected.push(item);
    });

    return [...selected, ...unselected];
}

function visibleCollapsedOptions<T extends { value: string }>(
    items: T[],
    isSelected: (value: string) => boolean,
    limit: number
): T[] {
    const ordered = orderOptionsSelectedFirst(items, isSelected);
    return ordered.slice(0, limit);
}

function compareFilterValues(a: string, b: string): number {
    const left = a.trim();
    const right = b.trim();

    const leftNum = Number.parseFloat(left);
    const rightNum = Number.parseFloat(right);
    const bothNumericPrefix = Number.isFinite(leftNum) && Number.isFinite(rightNum);

    // Handle "3200MHz" style values in natural numeric order.
    if (bothNumericPrefix) {
        if (leftNum !== rightNum) return leftNum - rightNum;
        return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    }

    return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

function sortFacetOptions<T extends { value: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => compareFilterValues(a.value, b.value));
}

// Smooth expand/collapse using CSS grid row trick
function FilterSection({
    id,
    title,
    badge,
    expanded,
    onToggle,
    children,
}: {
    id: string;
    title: string;
    badge?: number;
    expanded: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div className="border-b border-white/[0.06] last:border-0">
            <button
                type="button"
                id={`filter-header-${id}`}
                aria-expanded={expanded}
                aria-controls={`filter-panel-${id}`}
                onClick={onToggle}
                className="flex w-full items-center justify-between gap-2 py-3.5 text-left"
            >
                <div className="flex min-w-0 items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-100">{title}</span>
                    {badge != null && badge > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/25 px-1.5 text-[11px] font-semibold tabular-nums text-accent">
                            {badge}
                        </span>
                    ) : null}
                </div>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${
                        expanded ? "rotate-180" : ""
                    }`}
                    aria-hidden
                />
            </button>
            {/* Grid trick: animates height 0→1fr smoothly */}
            <div
                id={`filter-panel-${id}`}
                role="region"
                aria-labelledby={`filter-header-${id}`}
                className="grid transition-[grid-template-rows] duration-200"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="pb-4">{children}</div>
                </div>
            </div>
        </div>
    );
}

// Custom checkbox — avoids browser default styling inconsistencies
function FilterCheckbox({
    checked,
    onChange,
    label,
    count,
}: {
    checked: boolean;
    onChange: () => void;
    label: string;
    count?: number;
}) {
    return (
        <label className="group flex cursor-pointer items-center gap-3 rounded-lg py-2 px-1.5 transition-colors hover:bg-white/[0.04]">
            <span
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${
                    checked
                        ? "border-accent bg-accent"
                        : "border-zinc-600 bg-zinc-900 group-hover:border-zinc-500"
                }`}
            >
                {checked ? <Check className="h-3 w-3 text-zinc-950" strokeWidth={3} /> : null}
            </span>
            <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" tabIndex={-1} />
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-300 group-hover:text-zinc-100">
                {label}
            </span>
            {count != null ? (
                <span className="shrink-0 text-xs tabular-nums text-zinc-600">{count}</span>
            ) : null}
        </label>
    );
}

// Custom radio
function FilterRadio({
    checked,
    onChange,
    onClick,
    name,
    label,
    count,
}: {
    checked: boolean;
    onChange: () => void;
    onClick?: () => void;
    name: string;
    label: string;
    count?: number;
}) {
    return (
        <label
            className={`group flex cursor-pointer items-center gap-3 rounded-lg py-2 px-1.5 transition-colors hover:bg-white/[0.04] ${
                checked ? "bg-accent/10" : ""
            }`}
        >
            <span
                className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    checked
                        ? "border-accent"
                        : "border-zinc-600 group-hover:border-zinc-500"
                }`}
            >
                {checked ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                ) : null}
            </span>
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onChange}
                onClick={onClick}
                className="sr-only"
                tabIndex={-1}
            />
            <span
                className={`min-w-0 flex-1 truncate text-sm transition-colors group-hover:text-zinc-100 ${
                    checked ? "font-medium text-white" : "text-zinc-300"
                }`}
            >
                {label}
            </span>
            {count != null ? (
                <span className="shrink-0 text-xs tabular-nums text-zinc-600">{count}</span>
            ) : null}
        </label>
    );
}

const LIST_PREVIEW = 6;

export default function DynamicFilterSidebar({
    facets,
    filters,
    setFilters,
    isOpen,
    onClose,
}: DynamicFilterSidebarProps) {
    const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });
    const [sectionSearch, setSectionSearch] = useState<Record<string, string>>({});
    const [expandedLists, setExpandedLists] = useState<Record<string, boolean>>({});
    const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});

    const activeCount = countActiveFilters(filters);

    const isSectionOpen = (key: string) => !closedSections[key];
    const toggleSection = (key: string) =>
        setClosedSections((prev) => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        if (facets.price && filters.minPrice === undefined && filters.maxPrice === undefined) {
            setPriceRange({ min: facets.price.min, max: facets.price.max });
        }
    }, [facets.price, filters.minPrice, filters.maxPrice]);

    const applyPriceFilter = () =>
        setFilters({ ...filters, minPrice: priceRange.min, maxPrice: priceRange.max });

    const resetPriceFilter = () => {
        if (!facets.price) return;
        setPriceRange({ min: facets.price.min, max: facets.price.max });
        const next = { ...filters };
        delete next.minPrice;
        delete next.maxPrice;
        setFilters(next);
    };

    const handleBrandChange = (slug: string) => {
        const brandStr = typeof filters.brand === "string" ? filters.brand : "";
        const current = brandStr ? brandStr.split(",") : [];
        const next = current.includes(slug)
            ? current.filter((b: string) => b !== slug)
            : [...current, slug];
        const updated = { ...filters, brand: next.join(",") };
        if (next.length === 0) delete updated.brand;
        setFilters(updated);
    };

    const handleSpecChange = (key: string, value: string) => {
        const currentSpec = filters.spec || {};
        const current = currentSpec[key] ? (currentSpec[key] as string).split(",") : [];
        const next = current.includes(value)
            ? current.filter((v: string) => v !== value)
            : [...current, value];
        const newSpec = { ...currentSpec };
        if (next.length > 0) newSpec[key] = next.join(",");
        else delete newSpec[key];
        const updated = { ...filters, spec: newSpec };
        if (Object.keys(newSpec).length === 0) delete updated.spec;
        setFilters(updated);
    };

    const handleCategoryChange = (value: string) => {
        const next = { ...filters };
        if (filters.category === value) {
            delete next.category;
            delete next.brand;
            delete next.spec;
        } else {
            next.category = value;
            delete next.brand;
            delete next.spec;
        }
        setFilters(next);
    };

    const clearAll = () => {
        setFilters({ search: filters.search, sort: filters.sort });
        onClose();
    };

    const brandSelected = (slug: string) => {
        const b = typeof filters.brand === "string" ? filters.brand : "";
        return b.split(",").filter(Boolean).includes(slug);
    };

    const filterFacetOptions = <T extends { value: string; label?: string }>(
        items: T[],
        key: string
    ) => {
        const q = sectionSearch[key]?.trim().toLowerCase();
        if (!q) return items;
        return items.filter((item) =>
            `${item.label ?? ""} ${item.value}`.toLowerCase().includes(q)
        );
    };

    const activeFilterPills = useMemo(() => {
        const pills: { id: string; label: string; onRemove: () => void }[] = [];

        if (typeof filters.category === "string" && filters.category) {
            const lbl =
                facets.categories?.find((c) => c.value === filters.category)?.label ??
                formatFilterLabel(filters.category);
            pills.push({
                id: `cat-${filters.category}`,
                label: lbl,
                onRemove: () => {
                    const next = { ...filters };
                    delete next.category;
                    delete next.brand;
                    delete next.spec;
                    setFilters(next);
                },
            });
        }

        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            pills.push({
                id: "price",
                label: `${formatPriceLkr(Number(filters.minPrice ?? facets.price?.min ?? 0))} – ${formatPriceLkr(Number(filters.maxPrice ?? facets.price?.max ?? 0))}`,
                onRemove: resetPriceFilter,
            });
        }

        if (typeof filters.brand === "string" && filters.brand.trim()) {
            filters.brand
                .split(",")
                .filter(Boolean)
                .forEach((v: string) => {
                    const lbl =
                        facets.brands?.find((b) => b.value === v)?.label ?? formatFilterLabel(v);
                    pills.push({
                        id: `brand-${v}`,
                        label: lbl,
                        onRemove: () => handleBrandChange(v),
                    });
                });
        }

        if (filters.spec && typeof filters.spec === "object") {
            Object.entries(filters.spec).forEach(([key, raw]) => {
                if (typeof raw !== "string") return;
                raw.split(",")
                    .filter(Boolean)
                    .forEach((v) =>
                        pills.push({
                            id: `spec-${key}-${v}`,
                            label: `${formatFilterLabel(key)}: ${v}`,
                            onRemove: () => handleSpecChange(key, v),
                        })
                    );
            });
        }

        return pills;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [facets.brands, facets.categories, facets.price, filters]);

    const specActiveCount = (key: string) => {
        const v = filters.spec?.[key];
        return typeof v === "string" ? v.split(",").filter(Boolean).length : 0;
    };

    const brandsActiveCount = () => {
        const b = typeof filters.brand === "string" ? filters.brand : "";
        return b.split(",").filter(Boolean).length;
    };

    return (
        <>
            {/* Mobile overlay */}
            <div
                className={`fixed inset-0 z-40 bg-zinc-950/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
                    isOpen ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
                onClick={onClose}
                aria-hidden
            />

            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex h-full w-[min(360px,92vw)] flex-col
                    border-r border-white/[0.08] bg-zinc-900/98 shadow-2xl backdrop-blur-xl
                    transition-transform duration-300 ease-out
                    lg:static lg:z-0 lg:h-auto lg:w-[17rem] lg:shrink-0 lg:translate-x-0
                    lg:rounded-2xl lg:border lg:border-white/[0.08] lg:bg-zinc-900/50
                    lg:shadow-none lg:backdrop-blur-md lg:self-start
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}
                `}
            >
                {/* ── Header ── */}
                <div className="flex flex-shrink-0 items-center justify-between gap-2 px-5 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent">
                            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                        </div>
                        <span className="text-sm font-semibold text-white">Filters</span>
                        {activeCount > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/20 px-1.5 text-[11px] font-semibold tabular-nums text-accent">
                                {activeCount}
                            </span>
                        ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                        {activeCount > 0 ? (
                            <button
                                type="button"
                                onClick={clearAll}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10"
                            >
                                Clear all
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
                            aria-label="Close filters"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* ── Scrollable body (mobile only scrolls inside, desktop expands freely) ── */}
                <div className="flex-1 overflow-y-auto overscroll-contain lg:flex-none lg:overflow-visible">
                    <div className="space-y-0 px-5 pb-6">

                        {/* Active pills */}
                        {activeFilterPills.length > 0 ? (
                            <div className="mb-4 flex flex-wrap gap-1.5 rounded-xl border border-accent/15 bg-accent/[0.06] p-3">
                                {activeFilterPills.map((pill) => (
                                    <button
                                        key={pill.id}
                                        type="button"
                                        onClick={pill.onRemove}
                                        className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-zinc-900/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition-colors hover:border-red-500/30 hover:text-red-300"
                                    >
                                        <span className="max-w-[9rem] truncate">{pill.label}</span>
                                        <X className="h-3 w-3 shrink-0 opacity-60" />
                                    </button>
                                ))}
                            </div>
                        ) : null}

                        <p className="mb-4 text-xs leading-relaxed text-zinc-500">
                            Selected options stay pinned near the top so they are easier to review and remove.
                        </p>

                        {/* ── Category ── */}
                        {facets.categories && facets.categories.length > 0 ? (
                            <FilterSection
                                id="categories"
                                title="Category"
                                expanded={isSectionOpen("categories")}
                                onToggle={() => toggleSection("categories")}
                            >
                                <div className="space-y-0.5">
                                    {facets.categories.map((cat) => (
                                        <FilterRadio
                                            key={cat.value}
                                            name="categoryFilter"
                                            checked={filters.category === cat.value}
                                            onChange={() => handleCategoryChange(cat.value)}
                                            onClick={() => {
                                                if (filters.category === cat.value)
                                                    handleCategoryChange(cat.value);
                                            }}
                                            label={cat.label}
                                            count={cat.count}
                                        />
                                    ))}
                                </div>
                            </FilterSection>
                        ) : null}

                        {/* ── Price ── */}
                        {(!facets.allowedFilters || facets.allowedFilters.price) && facets.price ? (
                            <FilterSection
                                id="price"
                                title="Price (LKR)"
                                badge={
                                    filters.minPrice !== undefined || filters.maxPrice !== undefined
                                        ? 1
                                        : undefined
                                }
                                expanded={isSectionOpen("price")}
                                onToggle={() => toggleSection("price")}
                            >
                                <div className="space-y-3">
                                    <div className="rounded-xl border border-[#5E5E5E]/35 bg-[#1a1a1a]/90 px-3 py-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8E8E8E]">
                                            Current range
                                        </p>
                                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <div className="rounded-lg border border-[#5E5E5E]/25 bg-black/25 px-3 py-2.5">
                                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#8E8E8E]">
                                                    From
                                                </span>
                                                <span className="mt-1 block text-sm font-semibold tabular-nums leading-snug text-[#F1F1F1]">
                                                    {formatPriceLkr(priceRange.min)}
                                                </span>
                                            </div>
                                            <div className="rounded-lg border border-[#5E5E5E]/25 bg-black/25 px-3 py-2.5">
                                                <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#8E8E8E]">
                                                    To
                                                </span>
                                                <span className="mt-1 block text-sm font-semibold tabular-nums leading-snug text-[#F1F1F1]">
                                                    {formatPriceLkr(priceRange.max)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <label className="min-w-0 flex-1">
                                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#8E8E8E]">
                                                Min (LKR)
                                            </span>
                                            <input
                                                type="number"
                                                value={priceRange.min}
                                                min={facets.price?.min || 0}
                                                max={priceRange.max}
                                                onChange={(e) =>
                                                    setPriceRange((prev) => ({
                                                        ...prev,
                                                        min: Number(e.target.value),
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-[#5E5E5E]/40 bg-[#121212]/90 px-3 py-2.5 text-sm tabular-nums text-[#F1F1F1] focus:border-[#D12B28]/50 focus:outline-none focus:ring-2 focus:ring-[#D12B28]/30"
                                            />
                                        </label>
                                        <label className="min-w-0 flex-1">
                                            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#8E8E8E]">
                                                Max (LKR)
                                            </span>
                                            <input
                                                type="number"
                                                value={priceRange.max}
                                                min={priceRange.min}
                                                max={facets.price?.max || 1000000}
                                                onChange={(e) =>
                                                    setPriceRange((prev) => ({
                                                        ...prev,
                                                        max: Number(e.target.value),
                                                    }))
                                                }
                                                className="w-full rounded-lg border border-[#5E5E5E]/40 bg-[#121212]/90 px-3 py-2.5 text-sm tabular-nums text-[#F1F1F1] focus:border-[#D12B28]/50 focus:outline-none focus:ring-2 focus:ring-[#D12B28]/30"
                                            />
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={applyPriceFilter}
                                            className="flex-1 rounded-xl bg-[#D12B28] py-2.5 text-sm font-semibold text-[#F1F1F1] transition-colors hover:bg-[#E53A36]"
                                        >
                                            Apply
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetPriceFilter}
                                            className="rounded-xl border border-[#5E5E5E]/45 bg-[#242424]/80 px-4 py-2.5 text-sm font-medium text-[#B0B0B0] transition-colors hover:border-[#D12B28]/40 hover:text-[#F1F1F1]"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </FilterSection>
                        ) : null}

                        {/* ── Brands ── */}
                        {(!facets.allowedFilters || facets.allowedFilters.brand) &&
                        facets.brands &&
                        facets.brands.length > 0 ? (
                            <FilterSection
                                id="brands"
                                title="Brand"
                                badge={brandsActiveCount() || undefined}
                                expanded={isSectionOpen("brands")}
                                onToggle={() => toggleSection("brands")}
                            >
                                {facets.brands.length > LIST_PREVIEW ? (
                                    <div className="relative mb-2">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                                        <input
                                            type="text"
                                            autoComplete="off"
                                            value={sectionSearch.brands ?? ""}
                                            onChange={(e) =>
                                                setSectionSearch((p) => ({
                                                    ...p,
                                                    brands: e.target.value,
                                                }))
                                            }
                                            placeholder="Search brands"
                                            className="w-full rounded-lg border border-[#5E5E5E]/45 bg-[#121212]/90 py-2.5 pl-8 pr-3 text-sm text-[#F1F1F1] caret-[#D12B28] placeholder:text-[#8E8E8E] focus:border-[#D12B28]/50 focus:outline-none focus:ring-2 focus:ring-[#D12B28]/25"
                                        />
                                    </div>
                                ) : null}
                                <BrandList
                                    brands={filterFacetOptions(facets.brands, "brands")}
                                    brandSelected={brandSelected}
                                    handleBrandChange={handleBrandChange}
                                    expanded={expandedLists.brands ?? false}
                                    onToggleExpand={() =>
                                        setExpandedLists((p) => ({
                                            ...p,
                                            brands: !p.brands,
                                        }))
                                    }
                                />
                            </FilterSection>
                        ) : null}

                        {/* ── Spec filters ── */}
                        {filters.category &&
                            Object.entries(facets.specs || {}).map(([key, values]) => (
                                <FilterSection
                                    key={key}
                                    id={key}
                                    title={formatFilterLabel(key)}
                                    badge={specActiveCount(key) || undefined}
                                    expanded={isSectionOpen(key)}
                                    onToggle={() => toggleSection(key)}
                                >
                                    {values.length > LIST_PREVIEW ? (
                                        <div className="relative mb-2">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                                            <input
                                                type="text"
                                                autoComplete="off"
                                                value={sectionSearch[key] ?? ""}
                                                onChange={(e) =>
                                                    setSectionSearch((p) => ({
                                                        ...p,
                                                        [key]: e.target.value,
                                                    }))
                                                }
                                                placeholder={`Filter ${formatFilterLabel(key).toLowerCase()}`}
                                                className="w-full rounded-lg border border-[#5E5E5E]/45 bg-[#121212]/90 py-2.5 pl-8 pr-3 text-sm text-[#F1F1F1] caret-[#D12B28] placeholder:text-[#8E8E8E] focus:border-[#D12B28]/50 focus:outline-none focus:ring-2 focus:ring-[#D12B28]/25"
                                            />
                                        </div>
                                    ) : null}
                                    <SpecList
                                        items={filterFacetOptions(
                                            values.map((v) => ({ ...v, label: v.value })),
                                            key
                                        )}
                                        filterKey={key}
                                        filters={filters}
                                        handleSpecChange={handleSpecChange}
                                        expanded={expandedLists[key] ?? false}
                                        onToggleExpand={() =>
                                            setExpandedLists((p) => ({
                                                ...p,
                                                [key]: !p[key],
                                            }))
                                        }
                                    />
                                </FilterSection>
                            ))}
                    </div>
                </div>
            </aside>
        </>
    );
}

/* ── Sub-components for show-more lists ── */

function BrandList({
    brands,
    brandSelected,
    handleBrandChange,
    expanded,
    onToggleExpand,
}: {
    brands: { value: string; label: string; count: number }[];
    brandSelected: (v: string) => boolean;
    handleBrandChange: (v: string) => void;
    expanded: boolean;
    onToggleExpand: () => void;
}) {
    const ordered = orderOptionsSelectedFirst(brands, brandSelected);
    const visible = expanded
        ? ordered
        : visibleCollapsedOptions(ordered, brandSelected, LIST_PREVIEW);
    const hidden = Math.max(ordered.length - visible.length, 0);

    return (
        <div className="space-y-0.5">
            {visible.map((brand) => (
                <FilterCheckbox
                    key={brand.value}
                    checked={brandSelected(brand.value)}
                    onChange={() => handleBrandChange(brand.value)}
                    label={brand.label}
                    count={brand.count}
                />
            ))}
            {brands.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">No brands match.</p>
            ) : null}
            {hidden > 0 ? (
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className="mt-1 flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
                >
                    {expanded ? (
                        <>Show less</>
                    ) : (
                        <>Show {hidden} more</>
                    )}
                </button>
            ) : null}
        </div>
    );
}

function SpecList({
    items,
    filterKey,
    filters,
    handleSpecChange,
    expanded,
    onToggleExpand,
}: {
    items: { value: string; label: string; count: number }[];
    filterKey: string;
    filters: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    handleSpecChange: (key: string, value: string) => void;
    expanded: boolean;
    onToggleExpand: () => void;
}) {
    const isSelected = (value: string) => {
        const specVal = filters.spec?.[filterKey];
        return typeof specVal === "string" && specVal.split(",").filter(Boolean).includes(value);
    };
    const sortedItems = sortFacetOptions(items);
    const ordered = orderOptionsSelectedFirst(sortedItems, isSelected);
    const visible = expanded
        ? ordered
        : visibleCollapsedOptions(ordered, isSelected, LIST_PREVIEW);
    const hidden = Math.max(ordered.length - visible.length, 0);

    return (
        <div className="space-y-0.5">
            {visible.map((item) => {
                const checked = isSelected(item.value);
                return (
                    <FilterCheckbox
                        key={item.value}
                        checked={checked}
                        onChange={() => handleSpecChange(filterKey, item.value)}
                        label={item.value}
                        count={item.count}
                    />
                );
            })}
            {items.length === 0 ? (
                <p className="py-2 text-sm text-zinc-500">No options match.</p>
            ) : null}
            {hidden > 0 ? (
                <button
                    type="button"
                    onClick={onToggleExpand}
                    className="mt-1 flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
                >
                    {expanded ? <>Show less</> : <>Show {hidden} more</>}
                </button>
            ) : null}
        </div>
    );
}
