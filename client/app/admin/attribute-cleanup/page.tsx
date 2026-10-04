"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronDown, ChevronRight, Download, Layers, Search, Shuffle, Tags } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import StatusBadge from "@/components/admin/StatusBadge";
import { attributeMatchKey } from "@/lib/attributeMatchKey";
import { clusterSimilarNames } from "@/lib/attributeSimilarity";

interface Category {
    _id: string;
    name: string;
    parentId?: string | null;
}

interface InventoryName {
    key: string;
    name: string;
    variants: { name: string; count: number }[];
    sources: { spec: number; attribute: number };
    productCount: number;
    occurrenceCount: number;
    brands: { brand: string; count: number }[];
    groups: { group: string; count: number }[];
    signatures: {
        signature: string;
        label: string;
        count: number;
        brands: string[];
        samples: { value: string; productId: string; productTitle: string; brand: string }[];
    }[];
    flags: { ambiguous: boolean; brandSpecific: boolean; multiGroup: boolean };
}

interface Inventory {
    categoryId: string;
    categoryName: string;
    productCount: number;
    occurrenceCount: number;
    names: InventoryName[];
}

type Filter = "all" | "ambiguous" | "brandSpecific" | "multiGroup" | "similar";

const STEPS = ["Inventory", "Naming scheme (AI)", "Product proposals", "Review & apply"];

export default function AttributeCleanupPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [inventory, setInventory] = useState<Inventory | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<Filter>("all");
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const mainCategories = useMemo(
        () => categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name)),
        [categories]
    );

    useEffect(() => {
        api.get("/products/categories")
            .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
            .catch((err) => console.error("Failed to fetch categories", err));
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the report when the category changes
        setInventory(null);
        setExpanded(new Set());
        setError("");
        if (!selectedCategory) return;
        let cancelled = false;
        setLoading(true);
        api.get(`/admin/attribute-normalization/${selectedCategory}/inventory`)
            .then((res) => {
                if (!cancelled) setInventory(res.data);
            })
            .catch((err) => {
                console.error("Inventory failed", err);
                if (!cancelled) {
                    setError(
                        err?.response?.status === 401
                            ? "Your admin session has expired — log in again."
                            : "Could not build the inventory for this category."
                    );
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [selectedCategory]);

    const names = useMemo(() => inventory?.names ?? [], [inventory]);

    /** Names that probably mean the same thing (different wording) — key -> cluster label. */
    const similarClusters = useMemo(() => {
        const clusters = clusterSimilarNames(names.map((n) => n.name));
        const byKey = new Map<string, string[]>();
        for (const cluster of clusters) {
            for (const name of cluster.names) byKey.set(attributeMatchKey(name), cluster.names);
        }
        return byKey;
    }, [names]);

    const counts = useMemo(
        () => ({
            all: names.length,
            ambiguous: names.filter((n) => n.flags.ambiguous).length,
            brandSpecific: names.filter((n) => n.flags.brandSpecific).length,
            multiGroup: names.filter((n) => n.flags.multiGroup).length,
            similar: names.filter((n) => similarClusters.has(n.key)).length,
        }),
        [names, similarClusters]
    );

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return names.filter((n) => {
            if (filter === "ambiguous" && !n.flags.ambiguous) return false;
            if (filter === "brandSpecific" && !n.flags.brandSpecific) return false;
            if (filter === "multiGroup" && !n.flags.multiGroup) return false;
            if (filter === "similar" && !similarClusters.has(n.key)) return false;
            if (!q) return true;
            return (
                n.variants.some((v) => v.name.toLowerCase().includes(q)) ||
                n.signatures.some((s) => s.samples.some((x) => x.value.toLowerCase().includes(q)))
            );
        });
    }, [names, filter, search, similarClusters]);

    const toggle = (key: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    const downloadReport = () => {
        if (!inventory) return;
        const blob = new Blob([JSON.stringify(inventory, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attribute-inventory-${inventory.categoryName.toLowerCase().replace(/\s+/g, "-")}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const filterButtons: { id: Filter; label: string; tone: string }[] = [
        { id: "all", label: "All names", tone: "" },
        { id: "ambiguous", label: "Mixed meanings", tone: "text-danger" },
        { id: "brandSpecific", label: "Brand-specific", tone: "text-warning" },
        { id: "similar", label: "Similar wording", tone: "text-info" },
        { id: "multiGroup", label: "In several groups", tone: "" },
    ];

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10 lg:py-12">
            <PageHeader
                title="Attribute Cleanup"
                subtitle="Unify attribute names across brands. Only names change — values are never touched."
                action={
                    inventory ? (
                        <button
                            type="button"
                            onClick={downloadReport}
                            className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel"
                        >
                            <Download className="h-4 w-4" /> Download report
                        </button>
                    ) : null
                }
            />

            {/* Pipeline */}
            <ol className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {STEPS.map((step, i) => (
                    <li
                        key={step}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                            i === 0 ? "border-accent/50 bg-accent/10 text-main" : "border-border-soft text-sub opacity-60"
                        }`}
                    >
                        <span className="font-semibold">Step {i + 1}</span> · {step}
                        {i > 0 && <span className="ml-1">(coming next)</span>}
                    </li>
                ))}
            </ol>

            <div className="admin-card mb-6 rounded-xl p-6">
                <label className="mb-2 block text-sub">Main category</label>
                <select
                    className="w-full rounded-lg border border-border-soft bg-panel px-4 py-2 text-main [&>option]:text-white"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    <option value="">-- Choose main category --</option>
                    {mainCategories.map((c) => (
                        <option key={c._id} value={c._id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                <p className="mt-2 text-xs text-sub">
                    Read-only report. Includes products in all subcategories. Nothing in the database is changed on this step.
                </p>
            </div>

            {loading && <div className="py-10 text-center text-sub">Building inventory…</div>}
            {error && <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{error}</div>}

            {inventory && !loading && (
                <>
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat label="Products" value={inventory.productCount} />
                        <Stat label="Name uses" value={inventory.occurrenceCount} />
                        <Stat label="Distinct names" value={names.length} />
                        <Stat label="Mixed meanings" value={counts.ambiguous} tone="text-danger" />
                    </div>

                    <div className="admin-card rounded-xl p-6">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {filterButtons.map((b) => (
                                <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => setFilter(b.id)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                        filter === b.id ? "border-accent bg-accent/15 text-main" : "border-border-soft text-sub hover:text-main"
                                    }`}
                                >
                                    <span className={b.tone}>{b.label}</span> ({counts[b.id]})
                                </button>
                            ))}
                        </div>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search names or values…"
                                className="w-full rounded-lg border border-border-soft bg-surface py-2 pl-9 pr-3 text-sm text-main"
                            />
                        </div>

                        <div className="divide-y divide-border-soft">
                            {visible.map((n) => {
                                const open = expanded.has(n.key);
                                const similar = similarClusters.get(n.key)?.filter((x) => attributeMatchKey(x) !== n.key);
                                return (
                                    <div key={n.key} className="py-3">
                                        <button type="button" onClick={() => toggle(n.key)} className="flex w-full items-start gap-2 text-left">
                                            {open ? (
                                                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-sub" />
                                            ) : (
                                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-sub" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-main">{n.name}</span>
                                                    <span className="text-xs text-sub">
                                                        {n.productCount} products · {n.signatures.length} value shape
                                                        {n.signatures.length === 1 ? "" : "s"}
                                                    </span>
                                                    {n.flags.ambiguous && (
                                                        <StatusBadge tone="danger">
                                                            <AlertTriangle className="mr-1 inline h-3 w-3" />
                                                            Mixed meanings
                                                        </StatusBadge>
                                                    )}
                                                    {n.flags.brandSpecific && (
                                                        <StatusBadge tone="warning">
                                                            <Tags className="mr-1 inline h-3 w-3" />
                                                            Brand-specific
                                                        </StatusBadge>
                                                    )}
                                                    {n.flags.multiGroup && (
                                                        <StatusBadge tone="neutral">
                                                            <Layers className="mr-1 inline h-3 w-3" />
                                                            {n.groups.length} groups
                                                        </StatusBadge>
                                                    )}
                                                    {n.sources.spec > 0 && <StatusBadge tone="info">Filter spec</StatusBadge>}
                                                </div>
                                                <p className="mt-1 truncate text-xs text-sub">
                                                    {n.brands.map((b) => `${b.brand} (${b.count})`).join(" · ")}
                                                </p>
                                                {similar && similar.length > 0 && (
                                                    <p className="mt-1 flex items-center gap-1 text-xs text-info">
                                                        <Shuffle className="h-3 w-3" /> Similar wording: {similar.join(", ")}
                                                    </p>
                                                )}
                                            </div>
                                        </button>

                                        {open && (
                                            <div className="ml-6 mt-3 space-y-3">
                                                {n.variants.length > 1 && (
                                                    <p className="text-xs text-sub">
                                                        Spellings:{" "}
                                                        {n.variants.map((v) => `“${v.name}” (${v.count})`).join(", ")}
                                                    </p>
                                                )}
                                                {n.groups.length > 0 && (
                                                    <p className="text-xs text-sub">
                                                        Groups: {n.groups.map((g) => `${g.group} (${g.count})`).join(", ")}
                                                    </p>
                                                )}
                                                {n.signatures.map((sig) => (
                                                    <div key={sig.signature} className="rounded-lg border border-border-soft bg-panel p-3">
                                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                            <span className="text-sm font-medium text-main">
                                                                {sig.label}{" "}
                                                                <span className="text-xs text-sub">
                                                                    · {sig.count} use{sig.count === 1 ? "" : "s"} (
                                                                    {Math.round((sig.count / n.occurrenceCount) * 100)}%)
                                                                </span>
                                                            </span>
                                                            <span className="text-xs text-sub">{sig.brands.join(", ")}</span>
                                                        </div>
                                                        <ul className="space-y-1.5">
                                                            {sig.samples.map((sample, i) => (
                                                                <li key={i} className="text-xs">
                                                                    <span className="whitespace-pre-line text-main">{sample.value}</span>
                                                                    <span className="ml-2 text-sub">
                                                                        —{" "}
                                                                        <Link
                                                                            href={`/admin/products/${sample.productId}`}
                                                                            className="underline-offset-2 hover:text-main hover:underline"
                                                                            target="_blank"
                                                                        >
                                                                            {sample.brand} · {sample.productTitle}
                                                                        </Link>
                                                                    </span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {visible.length === 0 && <p className="py-8 text-center text-sm text-sub">No names match.</p>}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function Stat({ label, value, tone = "text-main" }: { label: string; value: number; tone?: string }) {
    return (
        <div className="admin-card rounded-xl p-4">
            <p className="text-xs text-sub">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value.toLocaleString()}</p>
        </div>
    );
}
