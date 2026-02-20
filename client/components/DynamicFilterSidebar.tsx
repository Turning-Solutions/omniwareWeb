"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from "lucide-react";
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

function formatPrice(value: number): string {
    if (value >= 1000) return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
    return `$${value}`;
}

export default function DynamicFilterSidebar({ facets, filters, setFilters, isOpen, onClose }: DynamicFilterSidebarProps) {
    // Local state for price to avoid heavy re-fetching while dragging
    const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });

    const activeCount = countActiveFilters(filters);

    // Track which sections the user has closed — all expanded by default
    const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});
    const isOpen_ = (key: string) => !closedSections[key];
    const toggleSection = (section: string) => {
        setClosedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };

    // Sync local price state when facets change (initial load or reset)
    useEffect(() => {
        if (facets.price && (filters.minPrice === undefined && filters.maxPrice === undefined)) {
            setPriceRange({ min: facets.price.min, max: facets.price.max });
        }
    }, [facets.price, filters.minPrice, filters.maxPrice]);

    const handlePriceChange = (min: number, max: number) => {
        setPriceRange({ min, max });
    };

    const applyPriceFilter = () => {
        setFilters({ ...filters, minPrice: priceRange.min, maxPrice: priceRange.max });
    };

    const handleBrandChange = (slug: string) => {
        const currentBrands = filters.brand ? (filters.brand as string).split(',') : [];
        const newBrands = currentBrands.includes(slug)
            ? currentBrands.filter((b: string) => b !== slug)
            : [...currentBrands, slug];

        const newFilters = { ...filters, brand: newBrands.join(',') };
        if (newBrands.length === 0) delete newFilters.brand;
        setFilters(newFilters);
    };

    const handleSpecChange = (key: string, value: string) => {
        const currentSpecParams = filters.spec || {};
        const currentValues = currentSpecParams[key] ? (currentSpecParams[key] as string).split(',') : [];

        const newValues = currentValues.includes(value)
            ? currentValues.filter((v: string) => v !== value)
            : [...currentValues, value];

        const newSpecParams = { ...currentSpecParams };
        if (newValues.length > 0) {
            newSpecParams[key] = newValues.join(',');
        } else {
            delete newSpecParams[key];
        }

        const newFilters = { ...filters, spec: newSpecParams };
        if (Object.keys(newSpecParams).length === 0) delete newFilters.spec;
        setFilters(newFilters);
    };

    const handleCategoryChange = (value: string) => {
        const newFilters = { ...filters };
        if (filters.category === value) {
            delete newFilters.category; // allow deselecting by clicking the active radio
        } else {
            newFilters.category = value;
        }
        setFilters(newFilters);
    };

    const clearAll = () => {
        setFilters({ search: filters.search, sort: filters.sort });
        onClose();
    };

    return (
        <>
            {/* Mobile Overlay */}
            <div
                className={`fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
            />

            {/* Sidebar — collapsible sections, scrolls with page; background ends with content */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-[min(320px,85vw)] bg-surface border-r border-border-soft transform transition-transform duration-300 ease-in-out
                lg:transform-none lg:static lg:w-72 lg:rounded-2xl lg:z-0 lg:border lg:border-border-soft lg:shadow-xl h-full lg:h-fit lg:self-start flex flex-col
                ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}>
                {/* Sticky header */}
                <div className="flex-shrink-0 flex items-center justify-between gap-3 p-4 lg:p-5 border-b border-border-soft bg-surface">
                    <div className="flex items-center gap-2 min-w-0">
                        <SlidersHorizontal className="h-5 w-5 text-accent flex-shrink-0" />
                        <h2 className="text-lg font-bold text-main truncate">Filters</h2>
                        {activeCount > 0 && (
                            <span className="flex-shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-accent/20 text-accent text-xs font-semibold flex items-center justify-center">
                                {activeCount}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {activeCount > 0 && (
                            <button
                                onClick={clearAll}
                                className="text-sm text-accent hover:text-accent/90 font-medium px-2 py-1 rounded-lg hover:bg-accent/10 transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 lg:hidden rounded-lg text-sub hover:text-main hover:bg-white/5 transition-colors"
                            aria-label="Close filters"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 lg:flex-none p-4 lg:p-5 space-y-4">

                    {/* Categories Filter — Always Visible */}
                    {facets.categories && facets.categories.length > 0 && (
                        <section className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                            <button
                                type="button"
                                className="flex items-center justify-between w-full text-left font-semibold text-main px-4 py-3 hover:bg-white/5 transition-colors"
                                onClick={() => toggleSection("categories")}
                            >
                                <span>Categories</span>
                                {isOpen_("categories") ? <ChevronUp className="h-4 w-4 text-sub" /> : <ChevronDown className="h-4 w-4 text-sub" />}
                            </button>
                            {isOpen_("categories") && (
                                <div className="px-4 pb-3 space-y-1">
                                    {facets.categories.map((category) => (
                                        <label key={category.value} className="flex items-center gap-3 cursor-pointer group py-2 px-2 rounded-lg hover:bg-white/5">
                                            <input
                                                type="radio"
                                                name="categoryFilter"
                                                checked={filters.category === category.value}
                                                onChange={() => handleCategoryChange(category.value)}
                                                onClick={() => { if (filters.category === category.value) handleCategoryChange(category.value); }}
                                                className="h-4 w-4 rounded-full border-2 border-white/20 bg-base text-accent focus:ring-2 focus:ring-accent/50 focus:ring-offset-0"
                                            />
                                            <span className="text-sub group-hover:text-main transition-colors text-sm flex-1 min-w-0 truncate">{category.label}</span>
                                            <span className="text-xs text-sub/60 tabular-nums">({category.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Price Filter — Always Visible (respects allowedFilters config) */}
                    {(!facets.allowedFilters || facets.allowedFilters.price) && facets.price && (
                        <section className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                            <button
                                type="button"
                                className="flex items-center justify-between w-full text-left font-semibold text-main px-4 py-3 hover:bg-white/5 transition-colors"
                                onClick={() => toggleSection("price")}
                            >
                                <span>Price Range</span>
                                {isOpen_("price") ? <ChevronUp className="h-4 w-4 text-sub" /> : <ChevronDown className="h-4 w-4 text-sub" />}
                            </button>
                            {isOpen_("price") && (
                                <div className="px-4 py-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <label className="flex-1 min-w-0">
                                            <span className="sr-only">Min price</span>
                                            <input
                                                type="number"
                                                value={priceRange.min}
                                                min={facets.price?.min || 0}
                                                max={priceRange.max}
                                                onChange={(e) => handlePriceChange(Number(e.target.value), priceRange.max)}
                                                className="w-full bg-base border border-white/15 rounded-lg px-3 py-2 text-sm text-main placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                                                placeholder="Min"
                                            />
                                        </label>
                                        <span className="text-sub font-medium">–</span>
                                        <label className="flex-1 min-w-0">
                                            <span className="sr-only">Max price</span>
                                            <input
                                                type="number"
                                                value={priceRange.max}
                                                min={priceRange.min}
                                                max={facets.price?.max || 1000000}
                                                onChange={(e) => handlePriceChange(priceRange.min, Number(e.target.value))}
                                                className="w-full bg-base border border-white/15 rounded-lg px-3 py-2 text-sm text-main placeholder:text-sub/50 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50"
                                                placeholder="Max"
                                            />
                                        </label>
                                    </div>
                                    <p className="text-xs text-sub/70">
                                        {formatPrice(priceRange.min)} – {formatPrice(priceRange.max)}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={applyPriceFilter}
                                        className="w-full py-2.5 bg-accent/15 text-accent hover:bg-accent/25 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Apply price
                                    </button>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Brands Filter — Always Visible (respects allowedFilters config) */}
                    {(!facets.allowedFilters || facets.allowedFilters.brand) && facets.brands && facets.brands.length > 0 && (
                        <section className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                            <button
                                type="button"
                                className="flex items-center justify-between w-full text-left font-semibold text-main px-4 py-3 hover:bg-white/5 transition-colors"
                                onClick={() => toggleSection("brands")}
                            >
                                <span>Brands</span>
                                {isOpen_("brands") ? <ChevronUp className="h-4 w-4 text-sub" /> : <ChevronDown className="h-4 w-4 text-sub" />}
                            </button>
                            {isOpen_("brands") && (
                                <div className="px-4 pb-3 space-y-1">
                                    {facets.brands.map((brand) => (
                                        <label key={brand.value} className="flex items-center gap-3 cursor-pointer group py-2 px-2 rounded-lg hover:bg-white/5">
                                            <input
                                                type="checkbox"
                                                checked={filters.brand?.split(',').includes(brand.value) ?? false}
                                                onChange={() => handleBrandChange(brand.value)}
                                                className="h-4 w-4 rounded border-2 border-white/20 bg-base text-accent focus:ring-2 focus:ring-accent/50 focus:ring-offset-0"
                                            />
                                            <span className="text-sub group-hover:text-main transition-colors text-sm flex-1 min-w-0 truncate">{brand.label}</span>
                                            <span className="text-xs text-sub/60 tabular-nums">({brand.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Dynamic Spec Filters — shown only when a category is selected */}
                    {filters.category && Object.entries(facets.specs || {}).map(([key, values]) => (
                        <section key={key} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                            <button
                                type="button"
                                className="flex items-center justify-between w-full text-left font-semibold text-main px-4 py-3 hover:bg-white/5 transition-colors capitalize"
                                onClick={() => toggleSection(key)}
                            >
                                <span>{key.replace(/_/g, " ")}</span>
                                {isOpen_(key) ? <ChevronUp className="h-4 w-4 text-sub" /> : <ChevronDown className="h-4 w-4 text-sub" />}
                            </button>
                            {isOpen_(key) && (
                                <div className="px-4 pb-3 space-y-1">
                                    {values.map((item) => (
                                        <label key={item.value} className="flex items-center gap-3 cursor-pointer group py-2 px-2 rounded-lg hover:bg-white/5">
                                            <input
                                                type="checkbox"
                                                checked={filters.spec?.[key]?.split(',').includes(item.value) ?? false}
                                                onChange={() => handleSpecChange(key, item.value)}
                                                className="h-4 w-4 rounded border-2 border-white/20 bg-base text-accent focus:ring-2 focus:ring-accent/50 focus:ring-offset-0"
                                            />
                                            <span className="text-sub group-hover:text-main transition-colors text-sm flex-1 min-w-0 truncate">{item.value}</span>
                                            <span className="text-xs text-sub/60 tabular-nums">({item.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}

                </div>
            </div>
        </>
    );
}
