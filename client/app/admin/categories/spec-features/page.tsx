"use client";

import { useState, useEffect } from "react";
import { Save, RefreshCw, Search } from "lucide-react";

interface Category {
    _id: string;
    name: string;
    slug: string;
}

export default function FeaturedSpecsAdmin() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");

    const [availableSpecKeys, setAvailableSpecKeys] = useState<string[]>([]);
    const [featuredSpecKeys, setFeaturedSpecKeys] = useState<Set<string>>(new Set());

    const [mode, setMode] = useState<"default_all" | "restricted" | "none">("default_all");
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        // Fetch categories on mount
        fetch(`/api/v1/products/categories`)
            .then(res => res.json())
            .then(data => setCategories(data))
            .catch(err => console.error("Failed to fetch categories", err));
    }, []);

    useEffect(() => {
        if (!selectedCategory) {
            setAvailableSpecKeys([]);
            setFeaturedSpecKeys(new Set());
            setMode("default_all");
            return;
        }

        const fetchSpecs = async () => {
            setLoading(true);
            try {
                // Fetch Available Specs
                const availRes = await fetch(`/api/v1/admin/categories/${selectedCategory}/spec-keys`);
                const availData = await availRes.json();

                // Fetch Featured Config
                const confRes = await fetch(`/api/v1/admin/categories/${selectedCategory}/featured-specs`);
                const confData = await confRes.json();

                setAvailableSpecKeys(availData.availableSpecKeys || []);
                setFeaturedSpecKeys(new Set(confData.featuredSpecKeys || []));
                setMode(confData.mode || "default_all");
            } catch (err) {
                console.error("Failed to fetch specs for category", err);
            } finally {
                setLoading(false);
            }
        };

        fetchSpecs();
    }, [selectedCategory]);

    const filteredSpecKeys = availableSpecKeys.filter(k => k.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleToggle = (key: string) => {
        const next = new Set(featuredSpecKeys);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setFeaturedSpecKeys(next);
    };

    const handleSelectAll = () => {
        setFeaturedSpecKeys(new Set(availableSpecKeys));
    };

    const handleClearAll = () => {
        setFeaturedSpecKeys(new Set());
    };

    const handleSave = async () => {
        if (!selectedCategory) return;
        setLoading(true);
        try {
            const token = JSON.parse(localStorage.getItem('userInfo') || '{}').token;
            const res = await fetch(`/api/v1/admin/categories/${selectedCategory}/featured-specs`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ featuredSpecKeys: Array.from(featuredSpecKeys) })
            });

            if (res.ok) {
                const updated = await res.json();
                setMode(updated.mode || "none");
                alert("Featured specs updated successfully");
            } else {
                alert("Failed to save configuration");
            }
        } catch (error) {
            console.error("Save error", error);
            alert("An error occurred while saving.");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async () => {
        if (!selectedCategory || !confirm("Are you sure you want to delete this configuration and revert to default behavior?")) return;
        setLoading(true);
        try {
            const token = JSON.parse(localStorage.getItem('userInfo') || '{}').token;
            const res = await fetch(`/api/v1/admin/categories/${selectedCategory}/featured-specs`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                setFeaturedSpecKeys(new Set());
                setMode("default_all");
                alert("Configuration deleted. Reverted to default behavior.");
            } else {
                alert("Failed to delete configuration");
            }
        } catch (error) {
            console.error("Delete error", error);
            alert("An error occurred while deleting.");
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
                    className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:ring-accent focus:border-accent"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    <option value="">-- Choose Category --</option>
                    {categories.map(c => (
                        <option key={c._id} value={c.slug}>{c.name}</option>
                    ))}
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
                        <div className="flex gap-3">
                            <button
                                onClick={handleReset}
                                disabled={loading || mode === 'default_all'}
                                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <RefreshCw className="h-4 w-4" /> Reset to Default
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="px-4 py-2 bg-accent text-white hover:bg-accent/90 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save className="h-4 w-4" /> Save Configuration
                            </button>
                        </div>
                    </div>

                    <div className="mb-4 flex flex-col sm:flex-row gap-4 justify-between items-center bg-base p-4 rounded-lg border border-border-soft">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sub" />
                            <input
                                type="text"
                                placeholder="Search spec keys..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-surface border border-border-soft rounded-lg pl-9 pr-4 py-2 text-sm text-main focus:ring-accent"
                            />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button
                                onClick={handleSelectAll}
                                className="flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium bg-surface border border-border-soft hover:bg-white/5 rounded text-main"
                            >
                                Select All
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="flex-1 sm:flex-none px-3 py-1.5 text-sm font-medium bg-surface border border-border-soft hover:bg-white/5 rounded text-main"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    {loading && availableSpecKeys.length === 0 ? (
                        <div className="text-center py-10 text-sub">Loading spec keys...</div>
                    ) : availableSpecKeys.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-border-soft rounded-lg text-sub">
                            No specifications found for products in this category.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {filteredSpecKeys.map(key => (
                                <label
                                    key={key}
                                    className={`
                                        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                                        ${featuredSpecKeys.has(key)
                                            ? 'bg-accent/10 border-accent/30 text-main'
                                            : 'bg-base border-border-soft text-sub hover:border-accent/40'}
                                    `}
                                >
                                    <input
                                        type="checkbox"
                                        checked={featuredSpecKeys.has(key)}
                                        onChange={() => handleToggle(key)}
                                        className="h-4 w-4 bg-surface border-border-soft rounded text-accent focus:ring-accent"
                                    />
                                    <span className="text-sm font-medium break-all">{key}</span>
                                </label>
                            ))}
                            {filteredSpecKeys.length === 0 && searchQuery && (
                                <div className="col-span-full text-center py-6 text-sub">
                                    No spec keys match your search.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
