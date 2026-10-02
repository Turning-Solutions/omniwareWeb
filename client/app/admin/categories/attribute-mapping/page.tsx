"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Link2, Plus, Save, Search, Sparkles, Trash2, X } from "lucide-react";
import api from "@/lib/api";
import PopupDialog from "@/components/PopupDialog";
import PageHeader from "@/components/admin/PageHeader";
import { attributeLooseKey, attributeMatchKey, type AttributeAliasGroup } from "@/lib/attributeMatchKey";
import { attributeSimilarity, clusterSimilarNames, SUGGESTION_THRESHOLD } from "@/lib/attributeSimilarity";

interface Category {
    _id: string;
    name: string;
    slug: string;
    parentId?: string | null;
}

interface AttributeInfo {
    key: string;
    name: string;
    variants: string[];
    productCount: number;
    sources: ("spec" | "attribute")[];
    groups: string[];
    samples: string[];
}

type Suggestion = {
    signature: string;
    keys: string[];
    reason: string;
    /** Existing mapping these names would join, if any. */
    groupIndex: number | null;
    canonical: string;
};

/** Prefer the most-used name; on a tie, the longer (more descriptive) one. */
function pickCanonical(attrs: AttributeInfo[]): string {
    return [...attrs].sort((a, b) => b.productCount - a.productCount || b.name.length - a.name.length)[0]?.name ?? "";
}

export default function AttributeMappingAdmin() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [attributes, setAttributes] = useState<AttributeInfo[]>([]);
    const [productCount, setProductCount] = useState(0);
    const [groups, setGroups] = useState<AttributeAliasGroup[]>([]);
    const [dirty, setDirty] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [mergeName, setMergeName] = useState("");
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [suggestionNames, setSuggestionNames] = useState<Record<string, string>>({});
    const [mappingSearch, setMappingSearch] = useState("");
    const [newMappingName, setNewMappingName] = useState("");
    const [popupInfo, setPopupInfo] = useState<{ title: string; message: string; tone: "success" | "danger" } | null>(null);

    const mainCategories = useMemo(
        () =>
            categories
                .filter((c) => !c.parentId)
                .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
        [categories]
    );

    useEffect(() => {
        api.get("/products/categories")
            .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
            .catch((err) => console.error("Failed to fetch categories", err));
    }, []);

    useEffect(() => {
        setSelectedKeys([]);
        setDismissed(new Set());
        setSuggestionNames({});
        setDirty(false);
        if (!selectedCategory) {
            setAttributes([]);
            setGroups([]);
            return;
        }
        let cancelled = false;
        setLoading(true);
        Promise.all([
            api.get(`/admin/categories/${selectedCategory}/attribute-names`),
            api.get(`/admin/categories/${selectedCategory}/attribute-aliases`),
        ])
            .then(([namesRes, aliasRes]) => {
                if (cancelled) return;
                setAttributes(namesRes.data.attributes ?? []);
                setProductCount(namesRes.data.productCount ?? 0);
                setGroups(aliasRes.data.groups ?? []);
            })
            .catch((err) => {
                console.error("Failed to load attributes", err);
                if (!cancelled) setPopupInfo({ title: "Load failed", message: "Could not load attributes for this category.", tone: "danger" });
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedCategory]);

    const attrByKey = useMemo(() => new Map(attributes.map((a) => [a.key, a])), [attributes]);

    /** match key -> index of the mapping that owns it */
    const ownerByKey = useMemo(() => {
        const map = new Map<string, number>();
        const loose = new Map<string, number>();
        groups.forEach((group, index) => {
            for (const alias of [group.canonical, ...group.aliases]) {
                const key = attributeMatchKey(alias);
                if (key && !map.has(key)) map.set(key, index);
                const looseKey = attributeLooseKey(alias);
                if (looseKey && !loose.has(looseKey)) loose.set(looseKey, index);
            }
        });
        // Names the compare page merges automatically (plural / bracketed note) count as mapped too.
        for (const attr of attributes) {
            if (map.has(attr.key)) continue;
            const index = loose.get(attributeLooseKey(attr.name));
            if (index != null) map.set(attr.key, index);
        }
        return map;
    }, [groups, attributes]);

    const suggestions = useMemo<Suggestion[]>(() => {
        const clusters = clusterSimilarNames(attributes.map((a) => a.name));
        const out: Suggestion[] = [];
        for (const cluster of clusters) {
            const keys = cluster.names.map(attributeMatchKey);
            const owners = new Set(keys.map((k) => ownerByKey.get(k) ?? null));
            const ownedGroups = [...owners].filter((o): o is number => o != null);
            // Already one mapping, or would merge two existing mappings — nothing to suggest.
            if (owners.size === 1 && ownedGroups.length === 1) continue;
            if (ownedGroups.length > 1) continue;
            const signature = [...keys].sort().join("|");
            if (dismissed.has(signature)) continue;
            const groupIndex = ownedGroups[0] ?? null;
            const attrs = keys.map((k) => attrByKey.get(k)).filter((a): a is AttributeInfo => Boolean(a));
            out.push({
                signature,
                keys,
                reason: cluster.reason,
                groupIndex,
                canonical: groupIndex != null ? groups[groupIndex].canonical : pickCanonical(attrs),
            });
        }
        return out;
    }, [attributes, attrByKey, ownerByKey, groups, dismissed]);

    const selectedAttrs = selectedKeys.map((k) => attrByKey.get(k)).filter((a): a is AttributeInfo => Boolean(a));

    /** Unselected attributes that look like what's selected — surfaced at the top of the list. */
    const similarToSelected = useMemo(() => {
        const map = new Map<string, number>();
        if (selectedAttrs.length === 0) return map;
        for (const attr of attributes) {
            if (selectedKeys.includes(attr.key)) continue;
            const score = Math.max(...selectedAttrs.map((s) => attributeSimilarity(s.name, attr.name).score));
            if (score >= SUGGESTION_THRESHOLD - 0.15) map.set(attr.key, score);
        }
        return map;
    }, [attributes, selectedAttrs, selectedKeys]);

    const visibleAttributes = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = attributes.filter(
            (a) => !q || a.name.toLowerCase().includes(q) || a.variants.some((v) => v.toLowerCase().includes(q))
        );
        return list.sort((a, b) => {
            const sa = similarToSelected.get(a.key) ?? -1;
            const sb = similarToSelected.get(b.key) ?? -1;
            return sb - sa || b.productCount - a.productCount;
        });
    }, [attributes, search, similarToSelected]);

    const updateGroups = (next: AttributeAliasGroup[]) => {
        setGroups(next);
        setDirty(true);
    };

    /** Put `names` into one mapping called `canonical`, absorbing any mappings they already belong to. */
    const mergeNames = (names: string[], canonical: string) => {
        const trimmed = canonical.trim();
        if (!trimmed || names.length === 0) return;
        const involved = new Set(names.map((n) => ownerByKey.get(attributeMatchKey(n))).filter((i): i is number => i != null));
        const absorbed = [...involved].flatMap((i) => [groups[i].canonical, ...groups[i].aliases]);
        const allNames: string[] = [];
        const seen = new Set<string>();
        for (const name of [...absorbed, ...names]) {
            const key = attributeMatchKey(name);
            if (!key || seen.has(key)) continue;
            seen.add(key);
            allNames.push(name);
        }
        const merged = { canonical: trimmed, aliases: allNames };
        const remaining = groups.filter((_, i) => !involved.has(i));
        updateGroups([...remaining, merged]);
    };

    /** Move `names` into the mapping at `index`, taking them out of any other mapping. */
    const addNamesToGroup = (index: number, names: string[]) => {
        const keys = new Set(names.map(attributeMatchKey).filter(Boolean));
        if (keys.size === 0) return;
        const next = groups
            .map((g, i) => {
                if (i === index) {
                    const existing = new Set(g.aliases.map(attributeMatchKey));
                    return { ...g, aliases: [...g.aliases, ...names.filter((n) => !existing.has(attributeMatchKey(n)))] };
                }
                return { ...g, aliases: g.aliases.filter((a) => !keys.has(attributeMatchKey(a))) };
            })
            .filter((g, i) => i === index || g.aliases.length > 0);
        updateGroups(next);
    };

    const addNewMapping = () => {
        const name = newMappingName.trim();
        if (!name) return;
        updateGroups([{ canonical: name, aliases: [name] }, ...groups]);
        setNewMappingName("");
    };

    const acceptSuggestion = (s: Suggestion) => {
        const names = s.keys.map((k) => attrByKey.get(k)?.name ?? k);
        mergeNames(names, suggestionNames[s.signature] ?? s.canonical);
    };

    const mergeSelected = () => {
        mergeNames(selectedAttrs.map((a) => a.name), mergeName || pickCanonical(selectedAttrs));
        setSelectedKeys([]);
        setMergeName("");
    };

    const toggleSelected = (key: string) => {
        setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    };

    const handleSave = async () => {
        if (!selectedCategory) return;
        setSaving(true);
        try {
            const { data } = await api.put(`/admin/categories/${selectedCategory}/attribute-aliases`, { groups });
            setGroups(data.groups ?? []);
            setDirty(false);
            setPopupInfo({ title: "Saved", message: "Attribute mappings saved. The compare page uses them right away.", tone: "success" });
        } catch (err) {
            console.error("Save failed", err);
            setPopupInfo({ title: "Save failed", message: "An error occurred while saving the mappings.", tone: "danger" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
            <PageHeader
                title="Attribute Mapping"
                subtitle="Merge differently-named specs and attributes (e.g. “OS” and “Operating System”) so they compare on one row."
                action={
                    selectedCategory ? (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !dirty}
                            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" /> {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                        </button>
                    ) : null
                }
            />

            <div className="admin-card mb-8 rounded-xl p-6">
                <label className="mb-2 block text-sub">Main category</label>
                <select
                    className="w-full rounded-lg border border-border-soft bg-panel px-4 py-2 text-main focus:border-accent focus:ring-accent [&>option]:text-white"
                    value={selectedCategory}
                    onChange={(e) => {
                        if (dirty && !window.confirm("Discard unsaved mapping changes?")) return;
                        setSelectedCategory(e.target.value);
                    }}
                >
                    <option value="">-- Choose main category --</option>
                    {mainCategories.map((c) => (
                        <option key={c._id} value={c._id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                {selectedCategory && !loading && (
                    <p className="mt-2 text-xs text-sub">
                        {attributes.length} attribute names across {productCount} products (including subcategories).
                    </p>
                )}
            </div>

            {selectedCategory && loading && <div className="py-10 text-center text-sub">Loading attributes…</div>}

            {selectedCategory && !loading && (
                <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
                    <div className="space-y-8">
                        {/* Mapped attributes */}
                        <section className="admin-card rounded-xl p-6">
                            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-main">
                                <Link2 className="h-5 w-5 text-accent" /> Mapped attributes ({groups.length})
                            </h2>
                            <p className="mb-4 text-xs text-sub">
                                Each mapping is shown as one row on the compare page. Rename it, add more names to it, or remove names.
                            </p>
                            <div className="mb-4 flex gap-2">
                                <input
                                    type="text"
                                    value={newMappingName}
                                    onChange={(e) => setNewMappingName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && addNewMapping()}
                                    placeholder="New mapping name (e.g. Terabytes Written)"
                                    className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm text-main"
                                />
                                <button
                                    type="button"
                                    onClick={addNewMapping}
                                    disabled={!newMappingName.trim()}
                                    className="flex items-center gap-1.5 rounded-lg bg-accent/20 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" /> New mapping
                                </button>
                            </div>
                            {groups.length > 4 && (
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
                                    <input
                                        type="text"
                                        value={mappingSearch}
                                        onChange={(e) => setMappingSearch(e.target.value)}
                                        placeholder="Search mappings…"
                                        className="w-full rounded-lg border border-border-soft bg-surface py-2 pl-9 pr-3 text-sm text-main"
                                    />
                                </div>
                            )}
                            {groups.length === 0 ? (
                                <p className="py-4 text-center text-sm text-sub">No mappings yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {groups.map((group, index) => {
                                        const q = mappingSearch.trim().toLowerCase();
                                        if (
                                            q &&
                                            !group.canonical.toLowerCase().includes(q) &&
                                            !group.aliases.some((a) => a.toLowerCase().includes(q))
                                        ) {
                                            return null;
                                        }
                                        return (
                                            <MappingCard
                                                key={index}
                                                group={group}
                                                index={index}
                                                groups={groups}
                                                attributes={attributes}
                                                attrByKey={attrByKey}
                                                ownerByKey={ownerByKey}
                                                onRename={(name) =>
                                                    updateGroups(groups.map((g, i) => (i === index ? { ...g, canonical: name } : g)))
                                                }
                                                onDelete={() => updateGroups(groups.filter((_, i) => i !== index))}
                                                onRemoveAlias={(alias) =>
                                                    updateGroups(
                                                        groups
                                                            .map((g, i) =>
                                                                i === index ? { ...g, aliases: g.aliases.filter((a) => a !== alias) } : g
                                                            )
                                                            .filter((g) => g.aliases.length > 0)
                                                    )
                                                }
                                                onAddNames={(names) => addNamesToGroup(index, names)}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Suggestions */}
                        <section className="admin-card rounded-xl p-6">
                            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold text-main">
                                <Sparkles className="h-5 w-5 text-accent" /> Suggested matches
                            </h2>
                            <p className="mb-4 text-xs text-sub">Names that look like the same attribute. Review and merge.</p>
                            {suggestions.length === 0 ? (
                                <p className="py-4 text-center text-sm text-sub">No suggestions — everything looks mapped.</p>
                            ) : (
                                <div className="space-y-3">
                                    {suggestions.map((s) => (
                                        <div key={s.signature} className="rounded-lg border border-border-soft bg-panel p-3">
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <span className="text-[11px] font-semibold uppercase tracking-wide text-sub">{s.reason}</span>
                                                {s.groupIndex != null && (
                                                    <span className="text-[11px] text-accent">joins “{groups[s.groupIndex].canonical}”</span>
                                                )}
                                            </div>
                                            <div className="mb-3 flex flex-wrap gap-1.5">
                                                {s.keys.map((k) => {
                                                    const attr = attrByKey.get(k);
                                                    return (
                                                        <span
                                                            key={k}
                                                            className="rounded-md border border-border-soft bg-surface px-2 py-1 text-xs text-main"
                                                            title={attr?.samples.join(" · ")}
                                                        >
                                                            {attr?.name ?? k}
                                                            <span className="ml-1 text-sub">({attr?.productCount ?? 0})</span>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={suggestionNames[s.signature] ?? s.canonical}
                                                    onChange={(e) =>
                                                        setSuggestionNames((prev) => ({ ...prev, [s.signature]: e.target.value }))
                                                    }
                                                    className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-main"
                                                    placeholder="Show as…"
                                                    aria-label="Merged name"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => acceptSuggestion(s)}
                                                    className="flex items-center gap-1 rounded-lg bg-accent/20 px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent/30"
                                                >
                                                    <Check className="h-4 w-4" /> Merge
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setDismissed((prev) => new Set(prev).add(s.signature))}
                                                    className="rounded-lg px-3 py-1.5 text-sm text-sub hover:bg-surface hover:text-main"
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* All attribute names */}
                    <section className="admin-card rounded-xl p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-hidden lg:flex lg:flex-col">
                        <h2 className="mb-1 text-lg font-bold text-main">All attributes</h2>
                        <p className="mb-4 text-xs text-sub">
                            Tick names to merge them manually. Similar names move to the top as you select.
                        </p>
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search attributes…"
                                className="w-full rounded-lg border border-border-soft bg-surface py-2 pl-9 pr-3 text-sm text-main"
                            />
                        </div>

                        {selectedAttrs.length > 0 && (
                            <div className="mb-3 rounded-lg border border-accent/40 bg-accent/10 p-3">
                                <p className="mb-2 text-xs text-main">
                                    {selectedAttrs.length} selected: {selectedAttrs.map((a) => a.name).join(", ")}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <input
                                        type="text"
                                        value={mergeName}
                                        onChange={(e) => setMergeName(e.target.value)}
                                        placeholder={pickCanonical(selectedAttrs) || "Show as…"}
                                        className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-main"
                                        aria-label="Merged name"
                                    />
                                    <button
                                        type="button"
                                        onClick={mergeSelected}
                                        disabled={selectedAttrs.length < 2 && !mergeName.trim()}
                                        className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                                        title={selectedAttrs.length < 2 ? "Select two or more names, or type a new name to rename one" : undefined}
                                    >
                                        {selectedAttrs.length < 2 ? "Rename" : "Merge selected"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedKeys([])}
                                        className="rounded-lg px-3 py-1.5 text-sm text-sub hover:text-main"
                                    >
                                        Clear
                                    </button>
                                </div>
                                {groups.length > 0 && (
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            if (e.target.value === "") return;
                                            addNamesToGroup(Number(e.target.value), selectedAttrs.map((a) => a.name));
                                            setSelectedKeys([]);
                                            setMergeName("");
                                        }}
                                        className="mt-2 w-full rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-main [&>option]:text-white"
                                        aria-label="Add selected to an existing mapping"
                                    >
                                        <option value="">…or add selected to an existing mapping</option>
                                        {groups.map((g, i) => (
                                            <option key={i} value={i}>
                                                {g.canonical}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}

                        <div className="-mx-2 space-y-1 overflow-y-auto px-2 lg:flex-1">
                            {visibleAttributes.map((attr) => {
                                const owner = ownerByKey.get(attr.key);
                                const isSelected = selectedKeys.includes(attr.key);
                                const isSimilar = similarToSelected.has(attr.key);
                                return (
                                    <label
                                        key={attr.key}
                                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 transition-colors ${
                                            isSelected
                                                ? "border-accent/50 bg-accent/10"
                                                : isSimilar
                                                  ? "border-warning/40 bg-warning/5"
                                                  : "border-transparent hover:bg-panel"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelected(attr.key)}
                                            className="mt-1 h-4 w-4 accent-[#D12B28]"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-sm font-medium text-main">{attr.name}</span>
                                                <span className="text-xs text-sub">· {attr.productCount}</span>
                                                {attr.sources.includes("spec") && (
                                                    <span className="rounded bg-info/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-info">Spec</span>
                                                )}
                                                {isSimilar && (
                                                    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-warning">Similar</span>
                                                )}
                                                {owner != null && (
                                                    <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                                                        → {groups[owner].canonical}
                                                    </span>
                                                )}
                                            </div>
                                            {attr.samples.length > 0 && (
                                                <p className="mt-0.5 truncate text-xs text-sub" title={attr.samples.join(" · ")}>
                                                    {attr.samples.join(" · ")}
                                                </p>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                            {visibleAttributes.length === 0 && (
                                <p className="py-6 text-center text-sm text-sub">No attributes match.</p>
                            )}
                        </div>
                    </section>
                </div>
            )}

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

function MappingCard({
    group,
    index,
    groups,
    attributes,
    attrByKey,
    ownerByKey,
    onRename,
    onDelete,
    onRemoveAlias,
    onAddNames,
}: {
    group: AttributeAliasGroup;
    index: number;
    groups: AttributeAliasGroup[];
    attributes: AttributeInfo[];
    attrByKey: Map<string, AttributeInfo>;
    ownerByKey: Map<string, number>;
    onRename: (name: string) => void;
    onDelete: () => void;
    onRemoveAlias: (alias: string) => void;
    onAddNames: (names: string[]) => void;
}) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);

    const ownKeys = useMemo(() => new Set(group.aliases.map(attributeMatchKey)), [group.aliases]);

    /** Attribute names not in this mapping: typed matches first, otherwise the most similar ones. */
    const candidates = useMemo(() => {
        const q = query.trim().toLowerCase();
        const names = [group.canonical, ...group.aliases];
        return attributes
            .filter((a) => !ownKeys.has(a.key))
            .map((a) => ({
                attr: a,
                score: Math.max(...names.map((n) => attributeSimilarity(n, a.name).score)),
            }))
            .filter(({ attr, score }) =>
                q ? attr.name.toLowerCase().includes(q) || attr.variants.some((v) => v.toLowerCase().includes(q)) : score >= 0.5
            )
            .sort((x, y) => y.score - x.score || y.attr.productCount - x.attr.productCount)
            .slice(0, 8);
    }, [attributes, group.aliases, group.canonical, ownKeys, query]);

    const typed = query.trim();
    const typedIsNew = Boolean(typed) && !ownKeys.has(attributeMatchKey(typed)) && !attrByKey.has(attributeMatchKey(typed));

    const add = (name: string) => {
        onAddNames([name]);
        setQuery("");
    };

    return (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <div className="mb-2 flex items-center gap-2">
                <input
                    type="text"
                    value={group.canonical}
                    onChange={(e) => onRename(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm font-semibold text-main"
                    aria-label="Name shown on compare page"
                />
                <button
                    type="button"
                    onClick={onDelete}
                    className="rounded p-1.5 text-danger transition-colors hover:bg-danger/10"
                    title="Delete mapping"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {group.aliases.map((alias) => (
                    <span
                        key={alias}
                        className="inline-flex items-center gap-1 rounded-md border border-border-soft bg-surface px-2 py-1 text-xs text-main"
                        title={attrByKey.get(attributeMatchKey(alias))?.samples.join(" · ")}
                    >
                        {alias}
                        <span className="text-sub">({attrByKey.get(attributeMatchKey(alias))?.productCount ?? 0})</span>
                        <button
                            type="button"
                            onClick={() => onRemoveAlias(alias)}
                            className="text-sub hover:text-danger"
                            aria-label={`Remove ${alias}`}
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                ))}
            </div>

            <div className="relative mt-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && typed) {
                            e.preventDefault();
                            add(candidates[0]?.attr.name ?? typed);
                        }
                    }}
                    placeholder="+ Add attribute to this mapping…"
                    className="w-full rounded-lg border border-dashed border-border-soft bg-transparent px-3 py-1.5 text-xs text-main placeholder:text-sub focus:border-accent"
                />
                {open && (candidates.length > 0 || typedIsNew) && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border-soft bg-surface p-1 shadow-xl">
                        {!typed && (
                            <p className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-sub">Similar names</p>
                        )}
                        {candidates.map(({ attr, score }) => {
                            const owner = ownerByKey.get(attr.key);
                            return (
                                <button
                                    key={attr.key}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => add(attr.name)}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-main hover:bg-panel"
                                >
                                    <span className="min-w-0 flex-1 truncate">{attr.name}</span>
                                    <span className="shrink-0 text-sub">{attr.productCount}</span>
                                    {score >= SUGGESTION_THRESHOLD && (
                                        <span className="shrink-0 rounded bg-warning/15 px-1 text-[10px] font-semibold uppercase text-warning">
                                            Similar
                                        </span>
                                    )}
                                    {owner != null && owner !== index && (
                                        <span className="shrink-0 text-[10px] text-sub">moves from “{groups[owner]?.canonical}”</span>
                                    )}
                                </button>
                            );
                        })}
                        {typedIsNew && (
                            <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => add(typed)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-accent hover:bg-panel"
                            >
                                <Plus className="h-3 w-3" /> Add “{typed}” (not used by any product yet)
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
