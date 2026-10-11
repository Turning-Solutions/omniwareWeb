"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import { AlertTriangle, Check, ExternalLink, RefreshCw, SkipForward, Sparkles, Undo2, X } from "lucide-react";
import api from "@/lib/api";
import StatusBadge from "@/components/admin/StatusBadge";
import AiModelSettings from "./AiModelSettings";
import { errorMessage, isQuotaExhausted, isRetryable, retryWaitSeconds, sleep } from "./aiRequest";
import type { ActiveAi, ConversionDetail, ConversionItem } from "./types";

type Filter = "review" | "check" | "approved" | "skipped" | "waiting";

/** Dropdown choice meaning "I'll type the value myself". */
const TYPED = "__typed__";

const FILTERS: { id: Filter; label: string }[] = [
    { id: "review", label: "To review" },
    { id: "check", label: "Check carefully" },
    { id: "approved", label: "Approved" },
    { id: "skipped", label: "Left unchanged" },
    { id: "waiting", label: "Not prepared yet" },
];

const matches = (i: ConversionItem, f: Filter) =>
    f === "review"
        ? i.status === "pending"
        : f === "check"
          ? i.status === "pending" && i.needsLook
          : f === "approved"
            ? i.status === "approved"
            : f === "skipped"
              ? i.status === "skipped"
              : i.status === "queued" || i.status === "failed";

export default function ConvertStep({
    categoryId,
    categoryName,
    onGoToList,
}: {
    categoryId: string;
    categoryName: string;
    onGoToList: () => void;
}) {
    const [items, setItems] = useState<ConversionItem[]>([]);
    const [templateCount, setTemplateCount] = useState<number | null>(null);
    const [ai, setAi] = useState<ActiveAi | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");

    const [preparing, setPreparing] = useState(false);
    const [prepProgress, setPrepProgress] = useState<{ done: number; total: number } | null>(null);
    const [prepMessage, setPrepMessage] = useState("");

    const [filter, setFilter] = useState<Filter>("review");
    const [brand, setBrand] = useState("");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<ConversionDetail | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    /** Standard field -> id of the product detail whose value it takes ("" = empty). */
    const [choice, setChoice] = useState<Record<string, string>>({});
    /** Values the admin typed, per standard field (used when the choice is TYPED). */
    const [typed, setTyped] = useState<Record<string, string>>({});
    /** Values already used for each standard field on other products — suggestions while typing. */
    const [usedValues, setUsedValues] = useState<Record<string, { value: string; count: number }[]>>({});
    const [keep, setKeep] = useState<Set<string>>(new Set());
    const [acting, setActing] = useState<null | "approve" | "skip" | "undo" | "redo">(null);
    const [actionError, setActionError] = useState("");

    const loadQueue = useCallback(async () => {
        try {
            const { data } = await api.get(`/admin/attribute-normalization/${categoryId}/conversions`);
            setItems(data.items ?? []);
            setTemplateCount(data.templateCount ?? 0);
            setAi(data.ai ?? null);
            setLoadError("");
        } catch (err) {
            setLoadError(errorMessage(err, "Could not load the products."));
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    const loadUsedValues = useCallback(async () => {
        try {
            const { data } = await api.get(`/admin/attribute-normalization/${categoryId}/conversions/values`);
            setUsedValues(data.values ?? {});
        } catch {
            // suggestions are a convenience — typing still works without them
        }
    }, [categoryId]);

    useEffect(() => {
        void loadQueue();
        void loadUsedValues();
    }, [loadQueue, loadUsedValues]);

    // Products approved before a fix could still show removed details under "General" — clean those up once.
    useEffect(() => {
        api.post(`/admin/attribute-normalization/${categoryId}/conversions/repair`)
            .then(({ data }) => {
                if (data.fixed) toast.success(`Removed leftover old details from ${data.fixed} converted product${data.fixed === 1 ? "" : "s"}.`);
            })
            .catch(() => undefined);
    }, [categoryId]);

    const counts = useMemo(
        () => Object.fromEntries(FILTERS.map((f) => [f.id, items.filter((i) => matches(i, f.id)).length])) as Record<Filter, number>,
        [items]
    );
    const brands = useMemo(() => Array.from(new Set(items.map((i) => i.brand))).sort(), [items]);
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        // Search by product name or SKU (SKUs match ignoring spaces, dashes and case).
        const compact = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, "");
        const qCompact = compact(q);
        return items.filter(
            (i) =>
                matches(i, filter) &&
                (!brand || i.brand === brand) &&
                (!q || i.title.toLowerCase().includes(q) || (qCompact && (i.skus ?? []).some((sku) => compact(sku).includes(qCompact))))
        );
    }, [items, filter, brand, search]);

    // Keep a product open, and move on to the next one when it leaves the current list.
    useEffect(() => {
        if (visible.length === 0) {
            if (selectedId) setSelectedId(null);
            return;
        }
        if (!selectedId || !visible.some((i) => i.id === selectedId)) setSelectedId(visible[0].id);
    }, [visible, selectedId]);

    const openDetail = useCallback((d: ConversionDetail) => {
        setDetail(d);
        setChoice(Object.fromEntries(d.fields.map((f) => [f.name, f.basis === "typed" ? TYPED : (f.sources[0]?.id ?? "")])));
        setTyped(Object.fromEntries(d.fields.filter((f) => f.basis === "typed").map((f) => [f.name, f.value])));
        setKeep(new Set(d.existing.filter((x) => x.keep).map((x) => x.id)));
    }, []);

    useEffect(() => {
        setActionError("");
        if (!selectedId) {
            setDetail(null);
            return;
        }
        let cancelled = false;
        setLoadingDetail(true);
        api.get(`/admin/attribute-normalization/conversion/${selectedId}`)
            .then(({ data }) => !cancelled && openDetail(data))
            .catch((err) => !cancelled && setActionError(errorMessage(err, "Could not open this product.")))
            .finally(() => !cancelled && setLoadingDetail(false));
        return () => {
            cancelled = true;
        };
    }, [selectedId, openDetail]);

    /** Ask the AI to prepare the waiting products, a few per request, paced for free-tier limits. */
    const prepare = async (redoAll: boolean) => {
        if (redoAll && !window.confirm("Ask the AI again for every product that isn't approved yet? Your unsaved edits on those products are lost.")) return;
        setPreparing(true);
        setPrepMessage("");
        try {
            const { data: started } = await api.post(`/admin/attribute-normalization/${categoryId}/conversions/start`, { redoAll });
            const total = started.queued as number;
            if (!total) {
                toast.success("Every product is already prepared.");
                return;
            }
            setPrepProgress({ done: 0, total });
            let lastRequestAt = 0;
            let retries = 0;
            for (;;) {
                const gap = ai?.minGapSeconds ?? 13;
                const since = (Date.now() - lastRequestAt) / 1000;
                if (lastRequestAt && since < gap) {
                    setPrepMessage(`Pacing for the free AI limit — next batch in ${Math.ceil(gap - since)}s…`);
                    await sleep((gap - since) * 1000);
                    setPrepMessage("");
                }
                try {
                    lastRequestAt = Date.now();
                    const { data } = await api.post(`/admin/attribute-normalization/${categoryId}/conversions/next`);
                    retries = 0;
                    setPrepProgress({ done: Math.max(0, total - data.remaining), total });
                    await loadQueue();
                    if (!data.remaining || !data.processed) break;
                } catch (err) {
                    if (isRetryable(err) && retries < 3) {
                        retries += 1;
                        const wait = retryWaitSeconds(err);
                        setPrepMessage(`${errorMessage(err, "AI request failed.")} Trying again in ${wait}s (attempt ${retries}/3)…`);
                        await sleep(wait * 1000);
                        setPrepMessage("");
                        continue;
                    }
                    throw err;
                }
            }
            toast.success("Products are ready to review.");
        } catch (err) {
            setPrepMessage(
                isQuotaExhausted(err)
                    ? `${errorMessage(err, "AI limit reached.")} Progress is saved — press “Continue preparing” later, or choose another AI model below.`
                    : `${errorMessage(err, "The AI request failed.")} Progress is saved — press “Continue preparing”.`
            );
        } finally {
            setPreparing(false);
            setPrepProgress(null);
            await loadQueue();
        }
    };

    const nextAfter = (id: string): string | null => {
        const idx = visible.findIndex((i) => i.id === id);
        return visible[idx + 1]?.id ?? visible[idx - 1]?.id ?? null;
    };

    const updateItem = (id: string, patch: Partial<ConversionItem>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    const approve = async () => {
        if (!detail) return;
        setActing("approve");
        setActionError("");
        try {
            await api.post(`/admin/attribute-normalization/conversion/${detail.id}/approve`, {
                fields: detail.fields.map((f) =>
                    choice[f.name] === TYPED ? { name: f.name, value: typed[f.name] ?? "" } : { name: f.name, sourceId: choice[f.name] ?? "" }
                ),
                keep: Array.from(keep),
            });
            const next = nextAfter(detail.id);
            updateItem(detail.id, { status: "approved" });
            setSelectedId(next);
            toast.success("Product updated.");
            void loadUsedValues();
        } catch (err) {
            setActionError(errorMessage(err, "Could not save the product."));
        } finally {
            setActing(null);
        }
    };

    const skip = async () => {
        if (!detail) return;
        setActing("skip");
        setActionError("");
        try {
            await api.post(`/admin/attribute-normalization/conversion/${detail.id}/skip`);
            const next = nextAfter(detail.id);
            updateItem(detail.id, { status: "skipped" });
            setSelectedId(next);
        } catch (err) {
            setActionError(errorMessage(err, "Could not save that."));
        } finally {
            setActing(null);
        }
    };

    const undo = async () => {
        if (!detail || !window.confirm("Put this product's old details back?")) return;
        setActing("undo");
        setActionError("");
        try {
            await api.post(`/admin/attribute-normalization/conversion/${detail.id}/undo`);
            updateItem(detail.id, { status: "pending" });
            const { data } = await api.get(`/admin/attribute-normalization/conversion/${detail.id}`);
            openDetail(data);
            toast.success("Old details restored.");
        } catch (err) {
            setActionError(errorMessage(err, "Could not undo."));
        } finally {
            setActing(null);
        }
    };

    const redo = async () => {
        if (!detail) return;
        setActing("redo");
        setActionError("");
        try {
            const { data } = await api.post(`/admin/attribute-normalization/conversion/${detail.id}/redo`);
            openDetail(data);
            updateItem(detail.id, { status: data.status, needsLook: data.needsLook, error: data.error });
        } catch (err) {
            setActionError(errorMessage(err, "The AI request failed."));
        } finally {
            setActing(null);
        }
    };

    if (loading) return <div className="py-10 text-center text-sub">Loading…</div>;

    if (templateCount === 0) {
        return (
            <div className="admin-card rounded-xl p-8 text-center">
                <h2 className="text-lg font-bold text-main">Add the standard list first</h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-sub">The AI needs to know which details every {categoryName} product should have.</p>
                <button type="button" onClick={onGoToList} className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
                    Go to “Standard list”
                </button>
            </div>
        );
    }

    const total = items.length;
    const dealtWith = counts.approved + counts.skipped;
    const notPrepared = counts.waiting;
    const locked = detail?.status === "approved";
    // Which standard fields each current detail goes into, following the admin's choices.
    const usedBy = new Map<string, string[]>();
    for (const [field, id] of Object.entries(choice)) if (id && id !== TYPED) usedBy.set(id, [...(usedBy.get(id) ?? []), field]);
    const movedCount = detail ? detail.existing.filter((x) => usedBy.has(x.id)).length : 0;
    const removingCount = detail ? detail.existing.filter((x) => !usedBy.has(x.id) && (!keep.has(x.id) || x.replaced)).length : 0;

    return (
        <div className="space-y-6">
            <div className="admin-card rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                        <h2 className="text-lg font-bold text-main">Convert products to the standard list</h2>
                        <p className="mt-1 text-sm text-sub">
                            For each {categoryName} product the AI picks which of its current details belongs in each standard detail. Values are copied{" "}
                            <strong className="text-main">exactly as they are</strong> — never rewritten. Then you check every product, fix any wrong pick, choose which
                            leftover details to keep, and <strong className="text-main">approve</strong>. Nothing changes on a product until you approve it, and every
                            approval can be undone.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => prepare(false)}
                            disabled={preparing || !ai?.configured}
                            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                        >
                            <Sparkles className="h-4 w-4" />
                            {preparing ? "AI is working…" : total === 0 ? "Let the AI prepare the products" : notPrepared ? `Continue preparing (${notPrepared})` : "Prepare new products"}
                        </button>
                        {total > 0 && (
                            <button
                                type="button"
                                onClick={() => prepare(true)}
                                disabled={preparing || !ai?.configured}
                                className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel disabled:opacity-50"
                            >
                                <RefreshCw className="h-4 w-4" /> Prepare all again
                            </button>
                        )}
                    </div>
                </div>

                {prepProgress && (
                    <div className="mt-4">
                        <div className="mb-1 flex justify-between text-xs text-sub">
                            <span>
                                Asking {ai?.model || "the AI"}… {prepProgress.done} of {prepProgress.total} products prepared
                            </span>
                            <span>{Math.round((prepProgress.done / prepProgress.total) * 100)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-panel">
                            <div className="h-full bg-accent transition-all" style={{ width: `${(prepProgress.done / prepProgress.total) * 100}%` }} />
                        </div>
                    </div>
                )}
                {prepMessage && <p className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{prepMessage}</p>}
                {loadError && <p className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{loadError}</p>}

                {total > 0 && (
                    <div className="mt-4">
                        <div className="mb-1 flex justify-between text-xs text-sub">
                            <span>
                                {dealtWith} of {total} products done · {counts.approved} approved · {counts.skipped} left unchanged · {counts.review} to review
                                {notPrepared ? ` · ${notPrepared} not prepared yet` : ""}
                            </span>
                            <span>{Math.round((dealtWith / total) * 100)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-panel">
                            <div className="h-full bg-success transition-all" style={{ width: `${(dealtWith / total) * 100}%` }} />
                        </div>
                    </div>
                )}
            </div>

            <AiModelSettings active={ai} onChanged={(next) => setAi(next)} />

            {total === 0 ? (
                <div className="admin-card rounded-xl p-10 text-center text-sm text-sub">
                    Nothing prepared yet. Click <strong className="text-main">Let the AI prepare the products</strong> above — it takes a few minutes, and you can
                    start reviewing as soon as the first products are ready.
                </div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[21rem_1fr]">
                    {/* Product list */}
                    <div className="admin-card rounded-xl p-4 lg:flex lg:max-h-[calc(100vh-8rem)] lg:flex-col lg:overflow-hidden">
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
                                    {f.label} ({counts[f.id]})
                                </button>
                            ))}
                        </div>
                        <div className="mb-3 grid grid-cols-2 gap-2">
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search name or SKU…"
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
                                            {i.brand}
                                            {i.sku ? ` · ${i.sku}` : ""}
                                            {i.status === "pending" || i.status === "approved" ? ` · ${i.filled}/${i.fieldCount} filled` : ""}
                                            {i.status === "failed" ? " · AI failed" : ""}
                                        </span>
                                    </span>
                                    {i.needsLook && i.status === "pending" && <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="Check carefully" />}
                                    {i.status === "approved" && <Check className="h-4 w-4 shrink-0 text-success" aria-label="Approved" />}
                                </button>
                            ))}
                            {visible.length === 0 && (
                                <p className="py-8 text-center text-sm text-sub">{filter === "review" ? "🎉 Nothing left to review here." : "Nothing in this list."}</p>
                            )}
                        </div>
                    </div>

                    {/* Review panel */}
                    <div className="admin-card rounded-xl p-6">
                        {!selectedId ? (
                            <p className="py-10 text-center text-sm text-sub">Pick a product from the list.</p>
                        ) : loadingDetail && !detail ? (
                            <p className="py-10 text-center text-sm text-sub">Opening…</p>
                        ) : !detail ? (
                            <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{actionError || "Could not open this product."}</p>
                        ) : (
                            <div className="space-y-6">
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
                                    {detail.status === "approved" && <StatusBadge tone="success">Approved</StatusBadge>}
                                    {detail.status === "skipped" && <StatusBadge tone="neutral">Left unchanged</StatusBadge>}
                                </div>

                                {detail.staleMessage && (
                                    <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">{detail.staleMessage}</p>
                                )}

                                {detail.status === "queued" || detail.status === "failed" ? (
                                    <div className="rounded-lg border border-border-soft bg-panel p-4 text-sm text-sub">
                                        {detail.status === "failed" ? detail.error : "The AI hasn't prepared this product yet."}
                                        <button
                                            type="button"
                                            onClick={redo}
                                            disabled={Boolean(acting) || !ai?.configured}
                                            className="ml-3 rounded-lg border border-accent/40 px-3 py-1 text-accent hover:bg-accent/10 disabled:opacity-50"
                                        >
                                            {acting === "redo" ? "Asking…" : "Ask the AI now"}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {/* New standard details: each field takes one of the product's current details, value unchanged */}
                                        <section>
                                            <h4 className="text-sm font-bold text-main">New details — shown on the product page in this order</h4>
                                            <p className="mb-2 text-xs text-sub">
                                                The AI picks one of the product&apos;s current details for each — its value is copied <strong className="text-main">exactly as it is</strong>.
                                                If it picked the wrong one, choose another, choose “Type a value myself” to write it, or “Not on this product” to leave it empty.
                                            </p>
                                            <div className="overflow-hidden rounded-lg border border-border-soft">
                                                <ul className="divide-y divide-border-soft">
                                                    {detail.fields.map((f) => {
                                                        const chosenId = choice[f.name] ?? "";
                                                        const isTyped = chosenId === TYPED;
                                                        const chosen = detail.existing.find((x) => x.id === chosenId);
                                                        const changed = isTyped
                                                            ? !(f.basis === "typed" && (typed[f.name] ?? "") === f.value)
                                                            : chosenId !== (f.sources[0]?.id ?? "");
                                                        const sharedWith = chosenId && !isTyped
                                                            ? detail.fields.filter((o) => o.name !== f.name && (choice[o.name] ?? "") === chosenId).map((o) => o.name)
                                                            : [];
                                                        const warn = !locked && ((f.check && !changed) || sharedWith.length > 0);
                                                        return (
                                                            <li
                                                                key={f.name}
                                                                className={`grid gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] md:items-start md:gap-3 ${warn ? "bg-warning/5" : ""}`}
                                                            >
                                                                <div>
                                                                    <p className="text-sm font-semibold text-main">{f.name}</p>
                                                                    {f.example && <p className="text-[11px] text-sub">usually like: {f.example}</p>}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <select
                                                                        value={chosenId}
                                                                        disabled={locked}
                                                                        onChange={(e) => {
                                                                            const next = e.target.value;
                                                                            // Start the text box from the value currently shown, so it can just be tweaked.
                                                                            if (next === TYPED && typed[f.name] === undefined) {
                                                                                setTyped((prev) => ({ ...prev, [f.name]: chosen?.value ?? "" }));
                                                                            }
                                                                            setChoice((prev) => ({ ...prev, [f.name]: next }));
                                                                        }}
                                                                        aria-label={`Detail to use for ${f.name}`}
                                                                        className={`w-full rounded-lg border bg-surface px-2.5 py-1.5 text-sm text-main disabled:opacity-80 [&>option]:text-white ${
                                                                            changed ? "border-info/60" : warn ? "border-warning/60" : "border-border-soft"
                                                                        }`}
                                                                    >
                                                                        <option value="">— Not on this product (leave empty) —</option>
                                                                        <option value={TYPED}>✎ Type a value myself…</option>
                                                                        {detail.existing.map((x) => (
                                                                            <option key={x.id} value={x.id}>
                                                                                {x.name}: {x.value.length > 60 ? `${x.value.slice(0, 59)}…` : x.value}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    {isTyped ? (
                                                                        <>
                                                                            <input
                                                                                value={typed[f.name] ?? ""}
                                                                                disabled={locked}
                                                                                onChange={(e) => setTyped((prev) => ({ ...prev, [f.name]: e.target.value }))}
                                                                                placeholder={f.example ? `e.g. ${f.example}` : "Type the value"}
                                                                                aria-label={`Value for ${f.name}`}
                                                                                autoFocus={!locked}
                                                                                list={`used-values-${f.name.replace(/[^a-z0-9]+/gi, "-")}`}
                                                                                className="mt-1 w-full rounded-lg border border-info/60 bg-surface px-2.5 py-1.5 text-sm text-main disabled:opacity-80"
                                                                            />
                                                                            <datalist id={`used-values-${f.name.replace(/[^a-z0-9]+/gi, "-")}`}>
                                                                                {(usedValues[f.name] ?? []).map((u) => (
                                                                                    <option key={u.value} value={u.value} />
                                                                                ))}
                                                                            </datalist>
                                                                            {!locked && (usedValues[f.name]?.length ?? 0) > 0 && (
                                                                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                                                                    <span className="text-[11px] text-sub">Used on other products:</span>
                                                                                    {(usedValues[f.name] ?? []).slice(0, 8).map((u) => (
                                                                                        <button
                                                                                            key={u.value}
                                                                                            type="button"
                                                                                            onClick={() => setTyped((prev) => ({ ...prev, [f.name]: u.value }))}
                                                                                            title={u.value}
                                                                                            className={`max-w-[14rem] truncate rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                                                                                                (typed[f.name] ?? "") === u.value
                                                                                                    ? "border-accent bg-accent/15 text-main"
                                                                                                    : "border-border-soft text-sub hover:border-accent/50 hover:text-main"
                                                                                            }`}
                                                                                        >
                                                                                            {u.value} <span className="opacity-60">({u.count})</span>
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : chosen ? (
                                                                        <p className="mt-1 whitespace-pre-line break-words rounded bg-panel px-2 py-1 text-sm text-main">{chosen.value}</p>
                                                                    ) : locked && f.value ? (
                                                                        <p className="mt-1 whitespace-pre-line break-words rounded bg-panel px-2 py-1 text-sm text-main">{f.value}</p>
                                                                    ) : (
                                                                        <p className="mt-1 text-[11px] text-sub">Stays empty — not shown on the product page.</p>
                                                                    )}
                                                                    <p className="mt-1 text-[11px]">
                                                                        {isTyped ? (
                                                                            <span className="text-info">typed by you</span>
                                                                        ) : changed ? (
                                                                            <span className="text-info">changed by you</span>
                                                                        ) : sharedWith.length > 0 && !locked ? (
                                                                            <span className="text-warning">The same detail is also used for {sharedWith.join(", ")} — please check</span>
                                                                        ) : f.check && !locked ? (
                                                                            <span className="text-warning">AI wasn&apos;t sure — please check{f.note ? ` (${f.note})` : ""}</span>
                                                                        ) : null}
                                                                    </p>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>
                                        </section>

                                        {/* Current details: moved into the new list, or removed unless kept */}
                                        {detail.existing.length > 0 && (
                                            <section>
                                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                    <h4 className="text-sm font-bold text-main">
                                                        Current details — {movedCount} moved into the new details · {removingCount} will be removed
                                                    </h4>
                                                    {!locked && (
                                                        <span className="flex gap-3 text-xs">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    setKeep(new Set(detail.existing.filter((x) => !x.replaced && !(usedBy.get(x.id)?.length)).map((x) => x.id)))
                                                                }
                                                                className="text-accent hover:underline"
                                                            >
                                                                Keep all the leftover ones
                                                            </button>
                                                            <button type="button" onClick={() => setKeep(new Set())} className="text-sub hover:text-main">
                                                                Remove all leftovers
                                                            </button>
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mb-2 text-xs text-sub">
                                                    Greyed-out details disappear from the product. Tick <strong>Keep</strong> to keep one — it stays under “Product details”.
                                                </p>
                                                <ul className="divide-y divide-border-soft overflow-hidden rounded-lg border border-border-soft">
                                                    {detail.existing.map((x) => {
                                                        const kept = keep.has(x.id) && !x.replaced;
                                                        const movedInto = usedBy.get(x.id) ?? [];
                                                        const removed = !kept && movedInto.length === 0;
                                                        return (
                                                            <li key={x.id} className="flex items-start gap-3 px-3 py-2">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={kept}
                                                                    disabled={locked || x.replaced}
                                                                    onChange={(e) =>
                                                                        setKeep((prev) => {
                                                                            const next = new Set(prev);
                                                                            if (e.target.checked) next.add(x.id);
                                                                            else next.delete(x.id);
                                                                            return next;
                                                                        })
                                                                    }
                                                                    aria-label={`Keep ${x.name}`}
                                                                    className="mt-1 h-4 w-4 accent-[#D12B28]"
                                                                />
                                                                <div className={`min-w-0 flex-1 text-sm ${removed ? "opacity-50" : ""}`}>
                                                                    <p className={removed ? "text-sub line-through decoration-sub/50" : "text-main"}>
                                                                        <span className="font-medium">{x.name}</span>: {x.value}
                                                                    </p>
                                                                    <p className="text-[11px] text-sub">
                                                                        {x.container === "specs" ? "Key specification" : x.groupName}
                                                                        {movedInto.length
                                                                            ? ` · moves into “${movedInto.join("”, “")}” (same value)`
                                                                            : x.replaced
                                                                              ? " · replaced by the standard detail with the same name"
                                                                              : kept
                                                                                ? " · kept"
                                                                                : " · will be removed"}
                                                                        {kept && movedInto.length ? " · a copy is also kept" : ""}
                                                                    </p>
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </section>
                                        )}
                                    </>
                                )}

                                {actionError && <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{actionError}</p>}

                                <div className="flex flex-wrap items-center gap-2 border-t border-border-soft pt-4">
                                    {locked ? (
                                        <>
                                            <p className="mr-auto text-sm text-success">
                                                Approved{detail.approvedBy ? ` by ${detail.approvedBy}` : ""}
                                                {detail.approvedAt ? ` on ${new Date(detail.approvedAt).toLocaleString()}` : ""}.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={undo}
                                                disabled={Boolean(acting)}
                                                className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel disabled:opacity-50"
                                            >
                                                <Undo2 className="h-4 w-4" /> {acting === "undo" ? "Undoing…" : "Undo"}
                                            </button>
                                        </>
                                    ) : detail.status === "pending" || detail.status === "skipped" ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={approve}
                                                disabled={Boolean(acting) || detail.stale}
                                                className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
                                            >
                                                <Check className="h-4 w-4" /> {acting === "approve" ? "Saving…" : "Approve & next"}
                                            </button>
                                            {detail.status !== "skipped" && (
                                                <button
                                                    type="button"
                                                    onClick={skip}
                                                    disabled={Boolean(acting)}
                                                    className="flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel disabled:opacity-50"
                                                >
                                                    <X className="h-4 w-4" /> Leave unchanged
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedId(nextAfter(detail.id))}
                                                disabled={Boolean(acting) || visible.length < 2}
                                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sub hover:text-main disabled:opacity-50"
                                            >
                                                <SkipForward className="h-4 w-4" /> Decide later
                                            </button>
                                            <button
                                                type="button"
                                                onClick={redo}
                                                disabled={Boolean(acting) || !ai?.configured}
                                                className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-sub hover:text-main disabled:opacity-50"
                                                title="Throw away this suggestion and ask the AI again"
                                            >
                                                <RefreshCw className={`h-4 w-4 ${acting === "redo" ? "animate-spin" : ""}`} /> Ask AI again
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
