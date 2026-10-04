"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ChevronRight, Save, Search, Sparkles, Split, Trash2 } from "lucide-react";
import api from "@/lib/api";
import StatusBadge from "@/components/admin/StatusBadge";
import {
    CONFLICT,
    KEEP,
    UNSET,
    canonicalIdFromName,
    rowsToRules,
    rulesToRows,
    type CanonicalAttribute,
    type NamingRule,
    type ShapeRow,
} from "@/lib/attributeNamingRules";
import type { InventoryName, NamingScheme } from "./types";

type Filter = "attention" | "renamed" | "kept" | "all";

const NEW_NAME = "__new__";

const errorMessage = (err: unknown, fallback: string) => {
    const e = err as { response?: { status?: number; data?: { message?: string } } };
    if (e?.response?.status === 401) return "Your admin session has expired — log in again.";
    return e?.response?.data?.message || fallback;
};

/** Strip Mongo/extra fields so the payload matches the API schema. */
const cleanRule = (r: NamingRule): NamingRule => ({
    key: r.key,
    canonicalId: r.canonicalId ?? null,
    ...(r.signatures?.length ? { signatures: r.signatures } : {}),
    ...(r.brands?.length ? { brands: r.brands } : {}),
    confidence: r.confidence,
    ...(r.reason ? { reason: r.reason } : {}),
    source: r.source,
});

export default function NamingSchemeStep({ categoryId, names }: { categoryId: string; names: InventoryName[] }) {
    const [scheme, setScheme] = useState<NamingScheme | null>(null);
    const [geminiConfigured, setGeminiConfigured] = useState(true);
    const [model, setModel] = useState("");
    const [loading, setLoading] = useState(true);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState<null | "generating" | "saving" | "approving">(null);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [resumeFrom, setResumeFrom] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [problems, setProblems] = useState<string[]>([]);
    const [filter, setFilter] = useState<Filter>("attention");
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [showCanonical, setShowCanonical] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get(`/admin/attribute-normalization/${categoryId}/scheme`)
            .then(({ data }) => {
                if (cancelled) return;
                setScheme(data.scheme ?? null);
                setGeminiConfigured(Boolean(data.geminiConfigured));
                setModel(data.model ?? "");
                const g = data.scheme?.generation;
                if (g && g.totalChunks && g.completedChunks < g.totalChunks) setResumeFrom(g.completedChunks);
            })
            .catch((err) => !cancelled && setError(errorMessage(err, "Could not load the naming scheme.")))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [categoryId]);

    const canonical = useMemo(() => scheme?.canonical ?? [], [scheme]);
    const rules = useMemo(() => scheme?.rules ?? [], [scheme]);
    const canonicalById = useMemo(() => new Map(canonical.map((c) => [c.id, c])), [canonical]);
    const sortedCanonical = useMemo(() => [...canonical].sort((a, b) => a.name.localeCompare(b.name)), [canonical]);

    const rows = useMemo(() => {
        const out = names.map((n) => {
            const shapeRows = rulesToRows(
                n.key,
                n.signatures.map((s) => ({ signature: s.signature, brands: s.brands })),
                rules
            );
            const targets = shapeRows.flatMap((r) => (r.brandTargets ? Object.values(r.brandTargets) : [r.target]));
            const note = scheme?.unresolved.find((u) => u.key === n.key)?.note;
            const conflict = targets.includes(CONFLICT);
            const unset = targets.includes(UNSET);
            const lowConfidence = rules.some((r) => r.key === n.key && r.source === "ai" && r.confidence === "low");
            const renamed = targets.some((t) => t !== KEEP && t !== UNSET && t !== CONFLICT && canonicalById.get(t)?.name !== n.name);
            const attention = conflict || unset || Boolean(note) || lowConfidence;
            return { name: n, shapeRows, note, conflict, unset, lowConfidence, renamed, attention };
        });
        return out;
    }, [names, rules, scheme?.unresolved, canonicalById]);

    const counts = useMemo(
        () => ({
            all: rows.length,
            attention: rows.filter((r) => r.attention).length,
            renamed: rows.filter((r) => r.renamed && !r.attention).length,
            kept: rows.filter((r) => !r.renamed && !r.attention).length,
        }),
        [rows]
    );

    const usage = useMemo(() => {
        const map = new Map<string, number>();
        for (const r of rules) if (r.canonicalId) map.set(r.canonicalId, (map.get(r.canonicalId) ?? 0) + 1);
        return map;
    }, [rules]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (filter === "attention" && !r.attention) return false;
            if (filter === "renamed" && (!r.renamed || r.attention)) return false;
            if (filter === "kept" && (r.renamed || r.attention)) return false;
            if (!q) return true;
            return (
                r.name.variants.some((v) => v.name.toLowerCase().includes(q)) ||
                r.shapeRows.some((row) => canonicalById.get(row.target)?.name.toLowerCase().includes(q))
            );
        });
    }, [rows, filter, search, canonicalById]);

    const updateScheme = useCallback((patch: Partial<NamingScheme>) => {
        setScheme((prev) =>
            prev
                ? { ...prev, ...patch, status: "draft" }
                : { status: "draft", canonical: [], rules: [], unresolved: [], ...patch }
        );
        setDirty(true);
        setProblems([]);
    }, []);

    const addCanonical = (rawName: string): string | null => {
        const name = rawName.trim();
        if (!name) return null;
        const existing = canonical.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existing) return existing.id;
        let id = canonicalIdFromName(name);
        let n = 2;
        while (canonicalById.has(id)) id = `${canonicalIdFromName(name)}-${n++}`;
        updateScheme({ canonical: [...canonical, { id, name }] });
        return id;
    };

    /** Apply edited shape rows for one name back into the rules list. */
    const commitRows = (key: string, nextRows: ShapeRow[], newCanonical?: CanonicalAttribute[]) => {
        const otherRules = rules.filter((r) => r.key !== key);
        const keyRules = rowsToRules(key, nextRows, rules);
        const fullySet = nextRows.every((r) =>
            r.brandTargets ? Object.values(r.brandTargets).every((t) => t !== UNSET && t !== CONFLICT) : r.target !== UNSET && r.target !== CONFLICT
        );
        updateScheme({
            ...(newCanonical ? { canonical: newCanonical } : {}),
            rules: [...otherRules, ...keyRules],
            unresolved: fullySet ? (scheme?.unresolved ?? []).filter((u) => u.key !== key) : scheme?.unresolved ?? [],
        });
    };

    const setTarget = (key: string, shapeRows: ShapeRow[], index: number, value: string, brand?: string) => {
        let target = value;
        let newCanonical: CanonicalAttribute[] | undefined;
        if (value === NEW_NAME) {
            const name = window.prompt("New attribute name (Title Case, no units):")?.trim();
            if (!name) return;
            const existing = canonical.find((c) => c.name.toLowerCase() === name.toLowerCase());
            if (existing) {
                target = existing.id;
            } else {
                let id = canonicalIdFromName(name);
                let n = 2;
                while (canonicalById.has(id)) id = `${canonicalIdFromName(name)}-${n++}`;
                newCanonical = [...canonical, { id, name }];
                target = id;
            }
        }
        const next = shapeRows.map((r, i) => {
            if (i !== index) return r;
            if (brand && r.brandTargets) return { ...r, brandTargets: { ...r.brandTargets, [brand]: target } };
            return { ...r, target, brandTargets: null };
        });
        commitRows(key, next, newCanonical);
    };

    const toggleSplit = (key: string, shapeRows: ShapeRow[], index: number, brands: string[]) => {
        const next = shapeRows.map((r, i) => {
            if (i !== index) return r;
            if (r.brandTargets) {
                const values = new Set(Object.values(r.brandTargets));
                return { ...r, target: values.size === 1 ? [...values][0] : UNSET, brandTargets: null };
            }
            return { ...r, brandTargets: Object.fromEntries(brands.map((b) => [b, r.target])) };
        });
        commitRows(key, next);
    };

    const runGeneration = async (startChunk: number) => {
        if (
            startChunk === 0 &&
            scheme &&
            !window.confirm("Generate a new naming scheme with AI? This replaces the current draft (including your edits).")
        ) {
            return;
        }
        setBusy("generating");
        setError("");
        setProblems([]);
        let chunk = startChunk;
        let total = progress?.total ?? scheme?.generation?.totalChunks ?? 1;
        let rateLimitRetries = 0;
        try {
            while (chunk < total) {
                setProgress({ done: chunk, total });
                try {
                    const { data } = await api.post(`/admin/attribute-normalization/${categoryId}/scheme/generate`, { chunkIndex: chunk });
                    setScheme(data.scheme);
                    total = data.totalChunks;
                    chunk += 1;
                    rateLimitRetries = 0;
                    setResumeFrom(chunk < total ? chunk : null);
                } catch (err) {
                    const status = (err as { response?: { status?: number } })?.response?.status;
                    if (status === 429 && rateLimitRetries < 3) {
                        rateLimitRetries += 1;
                        setError(`Gemini rate limit reached — waiting 30s before retrying (attempt ${rateLimitRetries}/3)…`);
                        await new Promise((r) => setTimeout(r, 30_000));
                        setError("");
                        continue;
                    }
                    throw err;
                }
            }
            setProgress({ done: total, total });
            setDirty(false);
            setFilter("attention");
        } catch (err) {
            setResumeFrom(chunk);
            setError(`${errorMessage(err, "AI generation failed.")} You can resume from part ${chunk + 1}.`);
        } finally {
            setBusy(null);
        }
    };

    const save = async (): Promise<boolean> => {
        if (!scheme) return false;
        setBusy("saving");
        setError("");
        try {
            const { data } = await api.put(`/admin/attribute-normalization/${categoryId}/scheme`, {
                canonical: scheme.canonical.map(({ id, name, description }) => ({ id, name, ...(description ? { description } : {}) })),
                rules: scheme.rules.map(cleanRule),
                unresolved: scheme.unresolved.map(({ key, note }) => ({ key, note })),
            });
            setScheme(data.scheme);
            setProblems(data.problems ?? []);
            setDirty(false);
            return true;
        } catch (err) {
            setError(errorMessage(err, "Saving failed."));
            return false;
        } finally {
            setBusy(null);
        }
    };

    const approve = async () => {
        if (counts.attention > 0 &&
            !window.confirm(
                `${counts.attention} name(s) still need attention. Unset shapes keep their original names. Approve anyway?`
            )) {
            return;
        }
        if (dirty && !(await save())) return;
        setBusy("approving");
        setError("");
        try {
            const { data } = await api.post(`/admin/attribute-normalization/${categoryId}/scheme/approve`);
            setScheme(data.scheme);
            setProblems([]);
        } catch (err) {
            const e = err as { response?: { data?: { problems?: string[] } } };
            setProblems(e?.response?.data?.problems ?? []);
            setError(errorMessage(err, "Approval failed."));
        } finally {
            setBusy(null);
        }
    };

    const toggleExpanded = (key: string) =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });

    if (loading) return <div className="py-10 text-center text-sub">Loading naming scheme…</div>;

    const targetLabel = (t: string) =>
        t === KEEP ? "Keep original name" : t === UNSET ? "Not decided" : t === CONFLICT ? "Conflicting rules" : canonicalById.get(t)?.name ?? t;

    const renderTargetSelect = (value: string, onChange: (v: string) => void) => (
        <select
            value={value === UNSET || value === CONFLICT ? "" : value}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className={`w-full rounded-lg border bg-surface px-2 py-1.5 text-xs text-main [&>option]:text-white ${
                value === UNSET || value === CONFLICT ? "border-danger/60" : value === KEEP ? "border-border-soft" : "border-accent/50"
            }`}
        >
            <option value="">{value === CONFLICT ? "⚠ Conflicting rules — choose…" : "— Choose —"}</option>
            <option value={KEEP}>Keep original name</option>
            {sortedCanonical.map((c) => (
                <option key={c.id} value={c.id}>
                    {c.name}
                </option>
            ))}
            <option value={NEW_NAME}>+ New name…</option>
        </select>
    );

    return (
        <div className="space-y-6">
            {/* Status + actions */}
            <div className="admin-card rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-bold text-main">
                            <Sparkles className="h-5 w-5 text-accent" /> Naming scheme
                            {scheme && (
                                <StatusBadge tone={scheme.status === "approved" ? "success" : "warning"}>
                                    {scheme.status === "approved" ? "Approved" : "Draft"}
                                </StatusBadge>
                            )}
                            {dirty && <StatusBadge tone="info">Unsaved changes</StatusBadge>}
                        </h2>
                        <p className="mt-1 text-xs text-sub">
                            The AI proposes one canonical name per meaning. A raw name can be split by value shape or brand.
                            Nothing on products changes in this step.
                        </p>
                        {scheme?.status === "approved" && scheme.approvedAt && (
                            <p className="mt-1 text-xs text-success">
                                Approved {new Date(scheme.approvedAt).toLocaleString()}
                                {scheme.approvedBy ? ` by ${scheme.approvedBy}` : ""}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => runGeneration(0)}
                            disabled={Boolean(busy) || !geminiConfigured}
                            className="flex items-center gap-2 rounded-lg bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 disabled:opacity-50"
                        >
                            <Sparkles className="h-4 w-4" /> {scheme ? "Regenerate with AI" : "Generate with AI"}
                        </button>
                        {resumeFrom != null && busy !== "generating" && scheme && (
                            <button
                                type="button"
                                onClick={() => runGeneration(resumeFrom)}
                                disabled={!geminiConfigured}
                                className="rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent hover:bg-accent/10"
                            >
                                Resume (part {resumeFrom + 1})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={save}
                            disabled={!dirty || Boolean(busy)}
                            className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" /> {busy === "saving" ? "Saving…" : "Save draft"}
                        </button>
                        <button
                            type="button"
                            onClick={approve}
                            disabled={!scheme || Boolean(busy) || (scheme.status === "approved" && !dirty)}
                            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                        >
                            <CheckCircle2 className="h-4 w-4" /> {busy === "approving" ? "Approving…" : "Approve scheme"}
                        </button>
                    </div>
                </div>

                {!geminiConfigured && (
                    <p className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                        GEMINI_API_KEY is not set on the server. Add it to the environment and restart / redeploy.
                    </p>
                )}
                {busy === "generating" && progress && (
                    <div className="mt-4">
                        <div className="mb-1 flex justify-between text-xs text-sub">
                            <span>Asking {model || "Gemini"}… part {Math.min(progress.done + 1, progress.total)} of {progress.total}</span>
                            <span>{Math.round((progress.done / progress.total) * 100)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-panel">
                            <div className="h-full bg-accent transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                        </div>
                    </div>
                )}
                {error && <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
                {problems.length > 0 && (
                    <ul className="mt-4 list-disc space-y-1 rounded-lg border border-danger/40 bg-danger/10 p-3 pl-8 text-sm text-danger">
                        {problems.map((p, i) => (
                            <li key={i}>{p}</li>
                        ))}
                    </ul>
                )}
            </div>

            {!scheme ? (
                <div className="admin-card rounded-xl p-10 text-center text-sm text-sub">
                    No naming scheme yet. Click <strong>Generate with AI</strong> — it sends this category&apos;s attribute names,
                    value shapes and sample values to Gemini in small parts.
                </div>
            ) : (
                <>
                    {/* Canonical names */}
                    <div className="admin-card rounded-xl p-6">
                        <button
                            type="button"
                            onClick={() => setShowCanonical((v) => !v)}
                            className="flex w-full items-center justify-between text-left"
                        >
                            <span className="text-base font-bold text-main">Canonical names ({canonical.length})</span>
                            {showCanonical ? <ChevronDown className="h-4 w-4 text-sub" /> : <ChevronRight className="h-4 w-4 text-sub" />}
                        </button>
                        {showCanonical && (
                            <div className="mt-4 space-y-2">
                                {sortedCanonical.map((c) => (
                                    <div key={c.id} className="grid gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto_auto] sm:items-center">
                                        <input
                                            value={c.name}
                                            onChange={(e) =>
                                                updateScheme({
                                                    canonical: canonical.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)),
                                                })
                                            }
                                            className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm font-semibold text-main"
                                            aria-label="Canonical name"
                                        />
                                        <input
                                            value={c.description ?? ""}
                                            onChange={(e) =>
                                                updateScheme({
                                                    canonical: canonical.map((x) => (x.id === c.id ? { ...x, description: e.target.value } : x)),
                                                })
                                            }
                                            placeholder="What it means"
                                            className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-xs text-sub"
                                            aria-label="Description"
                                        />
                                        <span className="text-xs text-sub">{usage.get(c.id) ?? 0} rules</span>
                                        <button
                                            type="button"
                                            disabled={(usage.get(c.id) ?? 0) > 0}
                                            onClick={() => updateScheme({ canonical: canonical.filter((x) => x.id !== c.id) })}
                                            className="rounded p-1.5 text-danger hover:bg-danger/10 disabled:opacity-30"
                                            title={(usage.get(c.id) ?? 0) > 0 ? "In use — reassign its rules first" : "Delete"}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => addCanonical(window.prompt("New attribute name (Title Case, no units):") ?? "")}
                                    className="mt-2 text-sm text-accent hover:underline"
                                >
                                    + Add canonical name
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Per-name review */}
                    <div className="admin-card rounded-xl p-6">
                        <div className="mb-4 flex flex-wrap gap-2">
                            {(
                                [
                                    ["attention", "Needs attention", "text-danger"],
                                    ["renamed", "Will be renamed", "text-accent"],
                                    ["kept", "Keeps its name", ""],
                                    ["all", "All", ""],
                                ] as [Filter, string, string][]
                            ).map(([id, label, tone]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => setFilter(id)}
                                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                                        filter === id ? "border-accent bg-accent/15 text-main" : "border-border-soft text-sub hover:text-main"
                                    }`}
                                >
                                    <span className={tone}>{label}</span> ({counts[id]})
                                </button>
                            ))}
                        </div>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search raw or canonical names…"
                                className="w-full rounded-lg border border-border-soft bg-surface py-2 pl-9 pr-3 text-sm text-main"
                            />
                        </div>

                        <div className="divide-y divide-border-soft">
                            {visible.map((r) => {
                                const n = r.name;
                                // Names needing attention start open; clicking flips the default either way.
                                const open = r.attention ? !expanded.has(n.key) : expanded.has(n.key);
                                const summaryTargets = Array.from(
                                    new Set(r.shapeRows.flatMap((row) => (row.brandTargets ? Object.values(row.brandTargets) : [row.target])))
                                );
                                return (
                                    <div key={n.key} className="py-3">
                                        <button type="button" onClick={() => toggleExpanded(n.key)} className="flex w-full items-start gap-2 text-left">
                                            {open ? (
                                                <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-sub" />
                                            ) : (
                                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-sub" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-main">{n.name}</span>
                                                    <ArrowRight className="h-3.5 w-3.5 text-sub" />
                                                    {summaryTargets.map((t) => (
                                                        <span
                                                            key={t}
                                                            className={`rounded px-1.5 py-0.5 text-xs ${
                                                                t === UNSET || t === CONFLICT
                                                                    ? "bg-danger/15 text-danger"
                                                                    : t === KEEP
                                                                      ? "bg-panel text-sub"
                                                                      : "bg-accent/15 text-accent"
                                                            }`}
                                                        >
                                                            {targetLabel(t)}
                                                        </span>
                                                    ))}
                                                    <span className="text-xs text-sub">· {n.productCount} products</span>
                                                    {r.conflict && <StatusBadge tone="danger">Conflict</StatusBadge>}
                                                    {r.note && <StatusBadge tone="warning">Unresolved</StatusBadge>}
                                                    {r.lowConfidence && <StatusBadge tone="warning">Low confidence</StatusBadge>}
                                                    {n.flags.ambiguous && <StatusBadge tone="danger">Mixed meanings</StatusBadge>}
                                                    {n.sources.spec > 0 && <StatusBadge tone="info">Filter spec</StatusBadge>}
                                                </div>
                                                {r.note && (
                                                    <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                                                        <AlertTriangle className="h-3 w-3" /> {r.note}
                                                    </p>
                                                )}
                                            </div>
                                        </button>

                                        {open && (
                                            <div className="ml-6 mt-3 space-y-2">
                                                {r.shapeRows.map((row, index) => {
                                                    const shape = n.signatures.find((s) => s.signature === row.signature);
                                                    if (!shape) return null;
                                                    return (
                                                        <div key={row.signature} className="rounded-lg border border-border-soft bg-panel p-3">
                                                            <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-medium text-main">
                                                                        {shape.label}
                                                                        <span className="ml-1 text-xs text-sub">
                                                                            · {shape.count} use{shape.count === 1 ? "" : "s"} · {shape.brands.join(", ")}
                                                                        </span>
                                                                    </p>
                                                                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-sub">
                                                                        e.g. {shape.samples.slice(0, 2).map((s) => s.value).join("  |  ")}
                                                                    </p>
                                                                    {row.reason && (
                                                                        <p className="mt-1 text-xs italic text-sub">
                                                                            AI: {row.reason}
                                                                            {row.confidence ? ` (${row.confidence} confidence)` : ""}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {row.brandTargets ? (
                                                                        Object.entries(row.brandTargets).map(([brand, target]) => (
                                                                            <label key={brand} className="block text-xs text-sub">
                                                                                {brand}
                                                                                {renderTargetSelect(target, (v) => setTarget(n.key, r.shapeRows, index, v, brand))}
                                                                            </label>
                                                                        ))
                                                                    ) : (
                                                                        renderTargetSelect(row.target, (v) => setTarget(n.key, r.shapeRows, index, v))
                                                                    )}
                                                                    {shape.brands.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => toggleSplit(n.key, r.shapeRows, index, shape.brands)}
                                                                            className="flex items-center gap-1 text-xs text-sub hover:text-main"
                                                                        >
                                                                            <Split className="h-3 w-3" />
                                                                            {row.brandTargets ? "Same for all brands" : "Different per brand"}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {visible.length === 0 && (
                                <p className="py-8 text-center text-sm text-sub">
                                    {filter === "attention" ? "Nothing needs attention." : "No names match."}
                                </p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
