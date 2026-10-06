"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertTriangle, ArrowRight, Check, ExternalLink, RefreshCw, SkipForward, Undo2, Wand2, X } from "lucide-react";
import api from "@/lib/api";
import StatusBadge from "@/components/admin/StatusBadge";
import { attributeMatchKey } from "@/lib/attributeMatchKey";
import type { ReviewDetail, ReviewItem } from "./types";

type Filter = "waiting" | "look" | "done" | "left";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "waiting", label: "To review" },
    { id: "look", label: "Take a closer look" },
    { id: "done", label: "Done" },
    { id: "left", label: "Left unchanged" },
];

const errorText = (err: unknown, fallback: string) => {
    const e = err as { response?: { status?: number; data?: { message?: string } } };
    if (e?.response?.status === 401) return "Your admin session has expired — log in again.";
    return e?.response?.data?.message || fallback;
};

const matches = (item: ReviewItem, filter: Filter) =>
    filter === "waiting" ? item.status === "pending" : filter === "look" ? item.status === "pending" && item.needsLook : filter === "done" ? item.status === "accepted" : item.status === "rejected";

export default function ReviewStep({ categoryId, categoryName, onGoToNames }: { categoryId: string; categoryName: string; onGoToNames: () => void }) {
    const [items, setItems] = useState<ReviewItem[]>([]);
    const [schemeApproved, setSchemeApproved] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [preparing, setPreparing] = useState(false);
    const [filter, setFilter] = useState<Filter>("waiting");
    const [brand, setBrand] = useState("");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<ReviewDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [edits, setEdits] = useState<Record<number, string>>({});
    const [acting, setActing] = useState(false);
    const [actionError, setActionError] = useState("");
    const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

    const loadQueue = useCallback(async () => {
        setError("");
        try {
            const { data } = await api.get(`/admin/attribute-normalization/${categoryId}/proposals`);
            setItems(data.items ?? []);
            setSchemeApproved(Boolean(data.schemeApproved));
        } catch (err) {
            setError(errorText(err, "Could not load the products to review."));
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    useEffect(() => {
        void loadQueue();
    }, [loadQueue]);

    const counts = useMemo(
        () => ({
            waiting: items.filter((i) => matches(i, "waiting")).length,
            look: items.filter((i) => matches(i, "look")).length,
            done: items.filter((i) => matches(i, "done")).length,
            left: items.filter((i) => matches(i, "left")).length,
        }),
        [items]
    );
    const brands = useMemo(() => Array.from(new Set(items.map((i) => i.brand))).sort(), [items]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return items.filter((i) => matches(i, filter) && (!brand || i.brand === brand) && (!q || i.title.toLowerCase().includes(q)));
    }, [items, filter, brand, search]);

    const safeCount = useMemo(() => items.filter((i) => i.status === "pending" && !i.needsLook && (!brand || i.brand === brand)).length, [items, brand]);

    // Open the first product automatically, and keep the selection valid as the list changes.
    useEffect(() => {
        if (visible.length === 0) {
            if (selectedId) setSelectedId(null);
            return;
        }
        if (!selectedId || !visible.some((i) => i.id === selectedId)) setSelectedId(visible[0].id);
    }, [visible, selectedId]);

    useEffect(() => {
        setEdits({});
        setActionError("");
        if (!selectedId) {
            setDetail(null);
            return;
        }
        let cancelled = false;
        setLoadingDetail(true);
        api.get(`/admin/attribute-normalization/proposal/${selectedId}`)
            .then(({ data }) => !cancelled && setDetail(data))
            .catch((err) => !cancelled && setActionError(errorText(err, "Could not open this product.")))
            .finally(() => !cancelled && setLoadingDetail(false));
        return () => {
            cancelled = true;
        };
    }, [selectedId]);

    const prepare = async () => {
        if (items.length > 0 && !window.confirm("Build the suggestions again? Products you already accepted stay as they are; ones still waiting are rebuilt (your unsaved edits are lost).")) return;
        setPreparing(true);
        setError("");
        try {
            const { data } = await api.post(`/admin/attribute-normalization/${categoryId}/proposals/generate`);
            toast.success(
                data.productsToReview
                    ? `${data.productsToReview} products have name changes to review.`
                    : "Nothing to change — every product already uses the confirmed names."
            );
            await loadQueue();
        } catch (err) {
            setError(errorText(err, "Could not build the suggestions."));
        } finally {
            setPreparing(false);
        }
    };

    /** The product to show after the current one leaves the list. */
    const nextAfter = (id: string): string | null => {
        const idx = visible.findIndex((i) => i.id === id);
        return visible[idx + 1]?.id ?? visible[idx - 1]?.id ?? null;
    };

    const setStatus = (id: string, status: ReviewItem["status"]) =>
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));

    const accept = async () => {
        if (!detail) return;
        setActing(true);
        setActionError("");
        try {
            const changed = Object.entries(edits)
                .filter(([i, name]) => name.trim() !== detail.changes[Number(i)]?.newName)
                .map(([i, name]) => ({ index: Number(i), newName: name.trim() }));
            await api.post(`/admin/attribute-normalization/proposal/${detail.id}/accept`, { edits: changed });
            const next = nextAfter(detail.id);
            setStatus(detail.id, "accepted");
            setSelectedId(next);
            toast.success("Names updated.");
        } catch (err) {
            setActionError(errorText(err, "Could not apply the changes."));
        } finally {
            setActing(false);
        }
    };

    const leaveUnchanged = async () => {
        if (!detail) return;
        setActing(true);
        setActionError("");
        try {
            await api.post(`/admin/attribute-normalization/proposal/${detail.id}/reject`);
            const next = nextAfter(detail.id);
            setStatus(detail.id, "rejected");
            setSelectedId(next);
        } catch (err) {
            setActionError(errorText(err, "Could not save that."));
        } finally {
            setActing(false);
        }
    };

    const undo = async () => {
        if (!detail) return;
        if (!window.confirm("Put the old names back on this product?")) return;
        setActing(true);
        setActionError("");
        try {
            await api.post(`/admin/attribute-normalization/proposal/${detail.id}/revert`);
            const next = nextAfter(detail.id);
            setStatus(detail.id, "pending");
            setSelectedId(next);
            toast.success("Old names restored.");
        } catch (err) {
            setActionError(errorText(err, "Could not undo the changes."));
        } finally {
            setActing(false);
        }
    };

    const skip = () => {
        if (detail) setSelectedId(nextAfter(detail.id));
    };

    const acceptAllSafe = async () => {
        if (
            !window.confirm(
                `Apply the suggested names to ${safeCount} products without opening each one?\n\nOnly products with nothing unusual are included. You can still undo any of them later.`
            )
        ) {
            return;
        }
        setActing(true);
        setActionError("");
        let done = 0;
        setBulk({ done, total: safeCount });
        try {
            for (let guard = 0; guard < 200; guard++) {
                const { data } = await api.post(`/admin/attribute-normalization/${categoryId}/proposals/accept-safe`, brand ? { brand } : {});
                done += data.acceptedCount;
                setBulk({ done, total: safeCount });
                if (data.failed?.length) toast.error(`${data.failed.length} product(s) need a closer look (${data.failed[0].message}).`);
                if (!data.remaining || (data.acceptedCount === 0 && !data.failed?.length)) break;
            }
            toast.success(`${done} products updated.`);
        } catch (err) {
            setActionError(errorText(err, "Stopped early."));
        } finally {
            setBulk(null);
            setActing(false);
            await loadQueue();
        }
    };

    // Names that two of this product's changes would share (the server also checks the product's other names).
    const finalNames = detail?.changes.map((c, i) => (edits[i] ?? c.newName).trim()) ?? [];
    const clashes = useMemo(() => {
        const seen = new Map<string, number>();
        finalNames.forEach((n, i) => {
            const key = `${detail?.changes[i].container === "specs" ? "s" : "a"}|${attributeMatchKey(n)}`;
            seen.set(key, (seen.get(key) ?? 0) + 1);
        });
        return new Set(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detail, edits]);
    const rowClashes = (i: number) => clashes.has(`${detail?.changes[i].container === "specs" ? "s" : "a"}|${attributeMatchKey(finalNames[i] ?? "")}`);

    if (loading) return <div className="py-10 text-center text-sub">Loading…</div>;

    if (schemeApproved === false && items.length === 0) {
        return (
            <div className="admin-card rounded-xl p-8 text-center">
                <h2 className="text-lg font-bold text-main">Confirm the names first</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-sub">
                    The product changes are built from the names you confirm in the previous step. Nothing has been changed on any product.
                </p>
                <button type="button" onClick={onGoToNames} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
                    Go to “Choose names”
                </button>
            </div>
        );
    }

    const reviewed = counts.done + counts.left;
    const total = items.length;

    return (
        <div className="space-y-6">
            {/* What this step does + progress */}
            <div className="admin-card rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-2xl">
                        <h2 className="text-lg font-bold text-main">Review the product changes</h2>
                        <p className="mt-1 text-sm text-sub">
                            Here you see each {categoryName} product with the new names that were worked out in the previous step. You decide for each product:
                            <strong className="text-main"> accept</strong> it (the names change), edit a name first, or
                            <strong className="text-main"> leave it unchanged</strong>. Only names change — the values stay exactly as they are — and every accepted product can be undone.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={prepare}
                            disabled={preparing || acting}
                            className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel disabled:opacity-50"
                        >
                            <RefreshCw className={`h-4 w-4 ${preparing ? "animate-spin" : ""}`} />
                            {preparing ? "Working…" : total ? "Rebuild suggestions" : "Find the products to change"}
                        </button>
                        {safeCount > 0 && (
                            <button
                                type="button"
                                onClick={acceptAllSafe}
                                disabled={acting}
                                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                                title="Applies every waiting product that has nothing unusual about it"
                            >
                                <Wand2 className="h-4 w-4" /> Accept all {safeCount} simple ones{brand ? ` (${brand})` : ""}
                            </button>
                        )}
                    </div>
                </div>

                {total > 0 && (
                    <div className="mt-4">
                        <div className="mb-1 flex justify-between text-xs text-sub">
                            <span>
                                {reviewed} of {total} products dealt with · {counts.done} updated · {counts.left} left unchanged · {counts.waiting} to go
                            </span>
                            <span>{Math.round((reviewed / total) * 100)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-panel">
                            <div className="h-full bg-accent transition-all" style={{ width: `${(reviewed / total) * 100}%` }} />
                        </div>
                    </div>
                )}
                {bulk && <p className="mt-3 text-sm text-sub">Updating products… {bulk.done} of about {bulk.total} done.</p>}
                {error && <p className="mt-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
            </div>

            {total === 0 ? (
                <div className="admin-card rounded-xl p-10 text-center text-sm text-sub">
                    No product changes have been prepared yet. Click <strong>Find the products to change</strong> above.
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
                    {/* Queue */}
                    <div className="admin-card rounded-xl p-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-hidden lg:flex lg:flex-col">
                        <div className="mb-3 flex flex-wrap gap-1.5">
                            {FILTERS.map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setFilter(f.id)}
                                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                                        filter === f.id ? "border-accent bg-accent/15 text-main" : "border-border-soft text-sub hover:text-main"
                                    }`}
                                >
                                    {f.label} ({counts[f.id === "waiting" ? "waiting" : f.id]})
                                </button>
                            ))}
                        </div>
                        <div className="mb-3 grid grid-cols-2 gap-2">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search products…"
                                className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-sm text-main"
                            />
                            <select
                                value={brand}
                                onChange={(e) => setBrand(e.target.value)}
                                className="rounded-lg border border-border-soft bg-surface px-2 py-1.5 text-sm text-main [&>option]:text-white"
                            >
                                <option value="">All brands</option>
                                {brands.map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="-mx-1 max-h-96 space-y-1 overflow-y-auto px-1 lg:max-h-none lg:flex-1">
                            {visible.map((i) => (
                                <button
                                    key={i.id}
                                    type="button"
                                    onClick={() => setSelectedId(i.id)}
                                    className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors ${
                                        selectedId === i.id ? "border-accent/60 bg-accent/10" : "border-transparent hover:bg-panel"
                                    }`}
                                >
                                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-surface">
                                        <Image src={i.image || "/placeholder.svg"} alt="" fill sizes="40px" className="object-cover" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-main">{i.title}</span>
                                        <span className="block truncate text-xs text-sub">
                                            {i.brand} · {i.changeCount} name{i.changeCount === 1 ? "" : "s"} to change
                                        </span>
                                    </span>
                                    {i.needsLook && i.status === "pending" && <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="Take a closer look" />}
                                    {i.status === "accepted" && <Check className="h-4 w-4 shrink-0 text-success" aria-label="Done" />}
                                </button>
                            ))}
                            {visible.length === 0 && (
                                <p className="py-8 text-center text-sm text-sub">
                                    {filter === "waiting" ? "🎉 Nothing left to review here." : "Nothing in this list."}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Review panel */}
                    <div className="admin-card rounded-xl p-6">
                        {!selectedId || (!detail && !loadingDetail && !actionError) ? (
                            <p className="py-10 text-center text-sm text-sub">Pick a product from the list.</p>
                        ) : loadingDetail && !detail ? (
                            <p className="py-10 text-center text-sm text-sub">Opening…</p>
                        ) : detail ? (
                            <div className="space-y-5">
                                <div className="flex items-start gap-4">
                                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface">
                                        <Image src={detail.image || "/placeholder.svg"} alt="" fill sizes="64px" className="object-cover" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-base font-bold text-main">{detail.title}</h3>
                                        <p className="text-xs text-sub">{detail.brand}</p>
                                        <p className="mt-1 flex flex-wrap gap-3 text-xs">
                                            <Link href={`/admin/products/${detail.productId}`} target="_blank" className="flex items-center gap-1 text-accent hover:underline">
                                                Open in admin <ExternalLink className="h-3 w-3" />
                                            </Link>
                                            {detail.productSlug && (
                                                <Link href={`/product/${detail.productSlug}`} target="_blank" className="flex items-center gap-1 text-accent hover:underline">
                                                    View on site <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            )}
                                        </p>
                                    </div>
                                    {detail.status === "accepted" && <StatusBadge tone="success">Done</StatusBadge>}
                                    {detail.status === "rejected" && <StatusBadge tone="neutral">Left unchanged</StatusBadge>}
                                </div>

                                {detail.stale && detail.status !== "accepted" && (
                                    <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                                        {detail.staleMessage} Use “Rebuild suggestions” at the top to refresh.
                                    </p>
                                )}
                                {detail.collisions.length > 0 && detail.status !== "accepted" && (
                                    <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <span>
                                            Two details of this product would end up with the same name (“{detail.collisions.join("”, “")}”). Change one of the names below, or leave this product unchanged.
                                        </span>
                                    </p>
                                )}

                                <div className="overflow-hidden rounded-lg border border-border-soft">
                                    <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-3 border-b border-border-soft bg-panel px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-sub md:grid">
                                        <span>Called now</span>
                                        <span>Will be called</span>
                                        <span>Value (never changes)</span>
                                    </div>
                                    <ul className="divide-y divide-border-soft">
                                        {detail.changes.map((c, i) => {
                                            const edited = edits[i] !== undefined && edits[i].trim() !== c.newName;
                                            const locked = detail.status === "accepted";
                                            return (
                                                <li key={i} className="grid gap-2 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] md:gap-3">
                                                    <div className="min-w-0">
                                                        <p className="break-words text-sm text-sub line-through decoration-sub/40">{c.oldName}</p>
                                                        <p className="text-[11px] text-sub/80">{c.container === "specs" ? "Key specification" : c.groupName ?? "Details"}</p>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <ArrowRight className="hidden h-3.5 w-3.5 shrink-0 text-sub md:block" />
                                                            <input
                                                                value={locked ? c.newName : (edits[i] ?? c.newName)}
                                                                onChange={(e) => setEdits((prev) => ({ ...prev, [i]: e.target.value }))}
                                                                disabled={locked}
                                                                list="review-canonical-names"
                                                                aria-label={`New name for ${c.oldName}`}
                                                                className={`w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm font-semibold text-main disabled:opacity-80 ${
                                                                    rowClashes(i) ? "border-danger/60" : edited ? "border-info/60" : "border-accent/40"
                                                                }`}
                                                            />
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2 pl-0 text-[11px] text-sub md:pl-[1.375rem]">
                                                            {c.confidence === "low" && !locked && <span className="text-warning">AI wasn&apos;t sure</span>}
                                                            {edited && <span className="text-info">edited by you</span>}
                                                            {rowClashes(i) && <span className="text-danger">same name as another detail</span>}
                                                            {!locked && (
                                                                <button type="button" onClick={() => setEdits((prev) => ({ ...prev, [i]: c.oldName }))} className="underline hover:text-main">
                                                                    don&apos;t rename this one
                                                                </button>
                                                            )}
                                                            {c.reason && !locked && <span className="italic">AI: {c.reason}</span>}
                                                        </div>
                                                    </div>
                                                    <p className="line-clamp-3 min-w-0 whitespace-pre-line break-words text-sm text-main" title={c.value}>
                                                        {c.value}
                                                    </p>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                                <datalist id="review-canonical-names">
                                    {detail.canonicalNames.map((n) => (
                                        <option key={n} value={n} />
                                    ))}
                                </datalist>

                                {actionError && <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{actionError}</p>}

                                <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
                                    {detail.status === "accepted" ? (
                                        <>
                                            <p className="mr-auto text-sm text-success">
                                                Applied{detail.acceptedBy ? ` by ${detail.acceptedBy}` : ""}
                                                {detail.acceptedAt ? ` on ${new Date(detail.acceptedAt).toLocaleString()}` : ""}.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={undo}
                                                disabled={acting}
                                                className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel disabled:opacity-50"
                                            >
                                                <Undo2 className="h-4 w-4" /> Undo these changes
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                onClick={accept}
                                                disabled={acting || detail.stale}
                                                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
                                            >
                                                <Check className="h-4 w-4" /> {acting ? "Saving…" : "Accept & next"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={leaveUnchanged}
                                                disabled={acting}
                                                className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel disabled:opacity-50"
                                            >
                                                <X className="h-4 w-4" /> Leave unchanged
                                            </button>
                                            <button
                                                type="button"
                                                onClick={skip}
                                                disabled={acting || visible.length < 2}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sub hover:text-main disabled:opacity-50"
                                            >
                                                <SkipForward className="h-4 w-4" /> Decide later
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{actionError}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
