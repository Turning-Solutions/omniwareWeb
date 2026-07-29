"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, RefreshCw, Search, Plus, Trash2 } from "lucide-react";
import api from "@/lib/api";
import PopupDialog from "@/components/PopupDialog";

interface Category {
    _id: string;
    name: string;
    slug: string;
    parentId?: string | null;
}

const sortByName = <T extends { name: string }>(items: T[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

export default function FeaturedSpecsAdmin() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");

    const [availableSpecKeys, setAvailableSpecKeys] = useState<string[]>([]);
    /** Featured specs in display order; selected are shown first and can be edited */
    const [featuredSpecKeys, setFeaturedSpecKeys] = useState<string[]>([]);
    const [newSpecInput, setNewSpecInput] = useState("");

    const [mode, setMode] = useState<"default_all" | "restricted" | "none">("default_all");
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [popupInfo, setPopupInfo] = useState<{ title: string; message: string; tone: "success" | "danger" } | null>(null);
    const sortedCategories = sortByName(categories);
    const categoryById = useMemo(
        () => new Map(categories.map((category) => [String(category._id), category])),
        [categories]
    );
    /** Main categories and their direct subcategories are selectable; this UI doesn't support deeper nesting. */
    const selectableCategories = useMemo(
        () => {
            const getCategoryDepth = (category: Category): number => {
                let depth = 0;
                let parentId = category.parentId ? String(category.parentId) : "";
                const seen = new Set<string>();
                while (parentId && !seen.has(parentId)) {
                    seen.add(parentId);
                    depth += 1;
                    const parent = categoryById.get(parentId);
                    if (!parent) break;
                    parentId = parent.parentId ? String(parent.parentId) : "";
                }
                return depth;
            };

            return sortedCategories.filter((category) => getCategoryDepth(category) <= 1);
        },
        [sortedCategories, categoryById]
    );

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const categoriesRes = await api.get("/products/categories");
                setCategories(categoriesRes.data || []);
            } catch (err) {
                console.error("Failed to fetch categories", err);
            }
        };

        void fetchCategories();
    }, []);

    useEffect(() => {
        if (!selectedCategory) return;
        const stillSelectable = selectableCategories.some((category) => String(category._id) === selectedCategory);
        if (!stillSelectable) {
            setSelectedCategory("");
            setAvailableSpecKeys([]);
            setFeaturedSpecKeys([]);
            setMode("default_all");
        }
    }, [selectedCategory, selectableCategories]);

    useEffect(() => {
        if (!selectedCategory) {
            setAvailableSpecKeys([]);
            setFeaturedSpecKeys([]);
            setMode("default_all");
            return;
        }

        const fetchSpecs = async () => {
            setLoading(true);
            try {
                const [availRes, confRes] = await Promise.all([
                    api.get(`/admin/categories/${selectedCategory}/spec-keys`),
                    api.get(`/admin/categories/${selectedCategory}/featured-specs`)
                ]);

                setAvailableSpecKeys(availRes.data.availableSpecKeys || []);
                setFeaturedSpecKeys(confRes.data.featuredSpecKeys || []);
                setMode(confRes.data.mode || "default_all");
            } catch (err) {
                console.error("Failed to fetch specs for category", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSpecs();
    }, [selectedCategory]);

    const featuredSet = new Set(featuredSpecKeys);
    const availableOnly = availableSpecKeys.filter(k => !featuredSet.has(k));
    const filteredAvailable = availableOnly.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));

    const updateFeaturedAt = (index: number, newKey: string) => {
        const trimmed = newKey.trim();
        if (!trimmed) return;
        const next = [...featuredSpecKeys];
        next[index] = trimmed;
        setFeaturedSpecKeys(next);
    };

    const removeFeatured = (index: number) => {
        setFeaturedSpecKeys(featuredSpecKeys.filter((_, i) => i !== index));
    };

    const addFeatured = (key: string) => {
        const trimmed = key.trim();
        if (!trimmed || featuredSet.has(trimmed)) return;
        setFeaturedSpecKeys([...featuredSpecKeys, trimmed]);
        setNewSpecInput("");
    };

    const addFromAvailable = (key: string) => {
        if (featuredSet.has(key)) return;
        setFeaturedSpecKeys([...featuredSpecKeys, key]);
    };

    const handleSave = async () => {
        if (!selectedCategory) return;
        setLoading(true);
        try {
            const { data: updated } = await api.put(`/admin/categories/${selectedCategory}/featured-specs`, { featuredSpecKeys });
            setMode(updated.mode || "none");
            setPopupInfo({
                title: "Saved",
                message: "Featured specs updated successfully.",
                tone: "success",
            });
        } catch (error) {
            console.error("Save error", error);
            setPopupInfo({
                title: "Save failed",
                message: "An error occurred while saving.",
                tone: "danger",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (!selectedCategory) return;
        setLoading(true);
        try {
            await api.delete(`/admin/categories/${selectedCategory}/featured-specs`);
            setFeaturedSpecKeys([]);
            setMode("default_all");
            setPopupInfo({
                title: "Configuration reset",
                message: "Configuration deleted. Reverted to default behavior.",
                tone: "success",
            });
        } catch (error) {
            console.error("Delete error", error);
            setPopupInfo({
                title: "Reset failed",
                message: "An error occurred while deleting.",
                tone: "danger",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-main mb-8">Featured Category Specs Config</h1>

            <div className="bg-surface border border-border-soft rounded-xl p-6 mb-8">
                <label className="block text-sub mb-2">Select Category</label>
                <select
                    className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:ring-accent focus:border-accent [&>option]:text-white"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    <option value="">-- Choose Category --</option>
                    {selectableCategories.map(c => {
                        const parentName = c.parentId ? categoryById.get(String(c.parentId))?.name : null;
                        return (
                            <option key={c._id} value={c._id}>
                                {parentName ? `${c.name} (under ${parentName})` : c.name}
                            </option>
                        );
                    })}
                </select>
            </div>

            {selectedCategory && (
                <div className="bg-surface border border-border-soft rounded-xl p-6">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-main">Configure Filters</h2>
                            <p className="text-sm text-sub mt-1">
                                Mode:
                                <span className={`ml-2 font-medium px-2 py-0.5 rounded text-xs ${mode === 'default_all' ? 'bg-blue-500/10 text-blue-400' :
                                        mode === 'restricted' ? 'bg-amber-500/10 text-amber-400' :
                                            'bg-red-500/10 text-red-400'
                                    }`}>
                                    {mode === 'default_all' ? 'All spec filters shown (no config)' :
                                        mode === 'restricted' ? 'Only selected specs will show as filters' :
                                            'No spec filters will show for this category'}
                                </span>
                            </p>
                        </div>
                        <div className="flex w-full md:w-auto flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowResetConfirm(true)}
                                disabled={loading || mode === 'default_all'}
                                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="h-4 w-4" /> Reset to Default
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="px-4 py-2 bg-accent text-white hover:bg-accent/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Save className="h-4 w-4" /> Save Configuration
                            </button>
                        </div>
                    </div>

                    {loading && availableSpecKeys.length === 0 && featuredSpecKeys.length === 0 ? (
                        <div className="text-center py-10 text-sub">Loading spec keys...</div>
                    ) : (
                        <>
                            {/* Section 1: Selected featured specs first — editable list */}
                            <div className="mb-6">
                                <h3 className="text-sm font-semibold text-main mb-2">Featured specs (shown as filters) — edit or reorder</h3>
                                <div className="space-y-2">
                                    {featuredSpecKeys.map((key, index) => (
                                        <div
                                            key={`${index}-${key}`}
                                            className="flex items-center gap-2 p-3 rounded-lg border border-accent/30 bg-accent/10"
                                        >
                                            <input
                                                type="text"
                                                value={key}
                                                onChange={(e) => updateFeaturedAt(index, e.target.value)}
                                                className="flex-1 min-w-0 bg-surface border border-border-soft rounded-lg px-3 py-1.5 text-sm text-main focus:ring-accent focus:border-accent"
                                                placeholder="Spec key (e.g. Vram)"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeFeatured(index)}
                                                className="p-1.5 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                                title="Remove"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <input
                                        type="text"
                                        value={newSpecInput}
                                        onChange={(e) => setNewSpecInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && addFeatured(newSpecInput)}
                                        placeholder="Add new spec key..."
                                        className="flex-1 bg-surface border border-border-soft rounded-lg px-3 py-2 text-sm text-main focus:ring-accent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => addFeatured(newSpecInput)}
                                        className="px-3 py-2 bg-accent/20 text-accent hover:bg-accent/30 rounded-lg text-sm font-medium flex items-center gap-1.5"
                                    >
                                        <Plus className="h-4 w-4" /> Add
                                    </button>
                                </div>
                            </div>

                            {/* Section 2: Add from existing product specs */}
                            <div>
                                <h3 className="text-sm font-semibold text-main mb-2">Add from existing product specs</h3>
                                <div className="relative w-full max-w-xs mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sub" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-base border border-border-soft rounded-lg pl-9 pr-4 py-2 text-sm text-main focus:ring-accent"
                                    />
                                </div>
                                {availableOnly.length === 0 ? (
                                    <p className="text-sub text-sm py-4">
                                        {availableSpecKeys.length === 0
                                            ? "No specifications found for products in this category."
                                            : "All available spec keys are already in the featured list."}
                                    </p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {filteredAvailable.map(k => (
                                            <button
                                                key={k}
                                                type="button"
                                                onClick={() => addFromAvailable(k)}
                                                className="text-left px-3 py-2 rounded-lg border border-border-soft bg-base hover:border-accent/40 hover:bg-white/5 text-sub hover:text-main text-sm transition-colors"
                                            >
                                                + {k}
                                            </button>
                                        ))}
                                        {filteredAvailable.length === 0 && searchQuery && (
                                            <p className="col-span-full text-sub text-sm py-2">No keys match your search.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
            <PopupDialog
                open={showResetConfirm}
                title="Reset configuration"
                message="Are you sure you want to delete this configuration and revert to default behavior?"
                tone="danger"
                confirmText="Reset"
                cancelText="Cancel"
                onClose={() => setShowResetConfirm(false)}
                onConfirm={() => {
                    setShowResetConfirm(false);
                    void handleReset();
                }}
            />
            <PopupDialog
                open={Boolean(popupInfo)}
                title={popupInfo?.title || ""}
                message={popupInfo?.message || ""}
                tone={popupInfo?.tone || "info"}
                confirmText="OK"
                onClose={() => setPopupInfo(null)}
                onConfirm={() => setPopupInfo(null)}
            />
        </div>
    );
}
