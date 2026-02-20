"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Facets } from "@/hooks/useProducts";

interface DynamicFilterSidebarProps {
    facets: Facets;
    filters: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    setFilters: (filters: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    isOpen: boolean;
    onClose: () => void;
}

export default function DynamicFilterSidebar({ facets, filters, setFilters, isOpen, onClose }: DynamicFilterSidebarProps) {
    // Local state for price to avoid heavy re-fetching while dragging
    const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });

    // Track only sections the user has explicitly CLOSED — everything is open by default
    const [closedSections, setClosedSections] = useState<Record<string, boolean>>({});

    // Helper: a section is open unless the user explicitly closed it
    const isOpen_ = (key: string) => !closedSections[key];

    const toggleSection = (section: string) => {
        setClosedSections(prev => ({ ...prev, [section]: !prev[section] }));
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

            {/* Sidebar */}
            <div className={`
                fixed inset-y-0 left-0 z-50 w-80 bg-surface border-r border-border-soft p-6 transform transition-transform duration-300 ease-in-out lg:transform-none lg:static lg:w-72 lg:h-fit lg:rounded-xl lg:z-0 lg:border lg:border-border-soft lg:shadow-lg h-full overflow-y-auto scrollbar-hide
                ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            `}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-main">Filters</h2>
                    <button onClick={onClose} className="p-2 lg:hidden text-sub hover:text-main">
                        <X className="h-6 w-6" />
                    </button>
                    <button
                        onClick={clearAll}
                        className="text-sm text-accent hover:text-accent/80 font-medium"
                    >
                        Clear All
                    </button>
                </div>

                <div className="space-y-6">

                    {/* Categories Filter — Always Visible */}
                    {facets.categories && facets.categories.length > 0 && (
                        <div className="border-b border-border-soft pb-4">
                            <button
                                className="flex items-center justify-between w-full text-left font-semibold text-main mb-2"
                                onClick={() => toggleSection('categories')}
                            >
                                <span>Categories</span>
                                {isOpen_('categories') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {isOpen_('categories') && (
                                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pt-2">
                                    {facets.categories.map((category) => (
                                        <label key={category.value} className="flex items-center space-x-3 cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="radio"
                                                    name="categoryFilter"
                                                    checked={filters.category === category.value}
                                                    onChange={() => handleCategoryChange(category.value)}
                                                    onClick={() => {
                                                        // Allow unchecking a radio button by clicking it again
                                                        if (filters.category === category.value) {
                                                            handleCategoryChange(category.value);
                                                        }
                                                    }}
                                                    className="peer h-4 w-4 rounded-full border-border-soft bg-base text-accent focus:ring-accent focus:ring-offset-surface"
                                                />
                                            </div>
                                            <span className="text-sub group-hover:text-main transition-colors text-sm">{category.label}</span>
                                            <span className="ml-auto text-xs text-sub/50">({category.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Price Filter — Always Visible (respects allowedFilters config) */}
                    {(!facets.allowedFilters || facets.allowedFilters.price) && facets.price && (
                        <div className="border-b border-border-soft pb-4">
                            <button
                                className="flex items-center justify-between w-full text-left font-semibold text-main mb-2"
                                onClick={() => toggleSection('price')}
                            >
                                <span>Price Range</span>
                                {isOpen_('price') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {isOpen_('price') && (
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between gap-4">
                                        <input
                                            type="number"
                                            value={priceRange.min}
                                            min={facets.price?.min || 0}
                                            max={priceRange.max}
                                            onChange={(e) => handlePriceChange(Number(e.target.value), priceRange.max)}
                                            className="w-full bg-base border border-border-soft rounded px-2 py-1 text-sm text-main"
                                        />
                                        <span className="text-sub">-</span>
                                        <input
                                            type="number"
                                            value={priceRange.max}
                                            min={priceRange.min}
                                            max={facets.price?.max || 1000000}
                                            onChange={(e) => handlePriceChange(priceRange.min, Number(e.target.value))}
                                            className="w-full bg-base border border-border-soft rounded px-2 py-1 text-sm text-main"
                                        />
                                    </div>
                                    <button
                                        onClick={applyPriceFilter}
                                        className="w-full py-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Apply Price
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Brands Filter — Always Visible (respects allowedFilters config) */}
                    {(!facets.allowedFilters || facets.allowedFilters.brand) && facets.brands && facets.brands.length > 0 && (
                        <div className="border-b border-border-soft pb-4">
                            <button
                                className="flex items-center justify-between w-full text-left font-semibold text-main mb-2"
                                onClick={() => toggleSection('brands')}
                            >
                                <span>Brands</span>
                                {isOpen_('brands') ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {isOpen_('brands') && (
                                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pt-2">
                                    {facets.brands.map((brand) => (
                                        <label key={brand.value} className="flex items-center space-x-3 cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.brand?.split(',').includes(brand.value) ?? false}
                                                    onChange={() => handleBrandChange(brand.value)}
                                                    className="peer h-4 w-4 rounded border-border-soft bg-base text-accent focus:ring-accent focus:ring-offset-surface"
                                                />
                                            </div>
                                            <span className="text-sub group-hover:text-main transition-colors text-sm">{brand.label}</span>
                                            <span className="ml-auto text-xs text-sub/50">({brand.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Dynamic Spec Filters — shown only for keys with filterable:true products AND when a category is selected */}
                    {filters.category && Object.entries(facets.specs || {}).map(([key, values]) => (
                        <div key={key} className="border-b border-border-soft pb-4 last:border-0">
                            <button
                                className="flex items-center justify-between w-full text-left font-semibold text-main mb-2 capitalize"
                                onClick={() => toggleSection(key)}
                            >
                                <span>{key.replace(/_/g, ' ')}</span>
                                {isOpen_(key) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>

                            {isOpen_(key) && (
                                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin pt-2">
                                    {values.map((item) => (
                                        <label key={item.value} className="flex items-center space-x-3 cursor-pointer group">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={filters.spec?.[key]?.split(',').includes(item.value) ?? false}
                                                    onChange={() => handleSpecChange(key, item.value)}
                                                    className="peer h-4 w-4 rounded border-border-soft bg-base text-accent focus:ring-accent focus:ring-offset-surface"
                                                />
                                            </div>
                                            <span className="text-sub group-hover:text-main transition-colors text-sm">{item.value}</span>
                                            <span className="ml-auto text-xs text-sub/50">({item.count})</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                </div>
            </div>
        </>
    );
}
