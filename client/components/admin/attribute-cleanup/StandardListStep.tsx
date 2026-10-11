"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ListChecks, Save, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { attributeLooseKey } from "@/lib/attributeMatchKey";
import { TEMPLATE_PRESETS, parseTemplateText, templateToText, type TemplateAttribute } from "@/lib/attributeTemplates";
import { errorMessage } from "./aiRequest";
import type { InventoryName } from "./types";

/**
 * Step 2: the category's standard list — the details every product will show on its product page,
 * in this order. Names products use today that aren't on the list are shown greyed out: they will be
 * removed from products unless the admin keeps them while reviewing each product.
 */
export default function StandardListStep({
    categoryId,
    categoryName,
    names,
    onNext,
}: {
    categoryId: string;
    categoryName: string;
    names: InventoryName[];
    onNext: () => void;
}) {
    const [list, setList] = useState<TemplateAttribute[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        api.get(`/admin/attribute-normalization/${categoryId}/template`)
            .then(({ data }) => {
                if (cancelled) return;
                const attrs: TemplateAttribute[] = Array.isArray(data.attributes) ? data.attributes : [];
                setList(attrs);
                if (!attrs.length) setEditing(true);
            })
            .catch((err) => !cancelled && setError(errorMessage(err, "Could not load the list.")))
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [categoryId]);

    const parsed = useMemo(() => parseTemplateText(text), [text]);

    /** Names in use today that the list doesn't cover — they'll be removed unless kept per product. */
    const notOnList = useMemo(() => {
        const listed = new Set(list.map((a) => attributeLooseKey(a.name)));
        return names.filter((n) => !listed.has(attributeLooseKey(n.name))).sort((a, b) => b.productCount - a.productCount);
    }, [names, list]);

    const startEditing = () => {
        setText(templateToText(list));
        setEditing(true);
    };

    const save = async () => {
        setSaving(true);
        setError("");
        try {
            const { data } = await api.put(`/admin/attribute-normalization/${categoryId}/template`, { attributes: parsed });
            setList(data.template ?? parsed);
            setEditing(false);
        } catch (err) {
            setError(errorMessage(err, "Saving the list failed."));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="py-10 text-center text-sub">Loading the list…</div>;

    return (
        <div className="space-y-6">
            <div className="admin-card rounded-xl p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="max-w-3xl">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-main">
                            <ListChecks className="h-5 w-5 text-accent" /> Standard list for {categoryName}
                        </h2>
                        <p className="mt-1 text-sm text-sub">
                            These are the details every {categoryName} product will show on its product page — <strong className="text-main">in this order</strong>.
                            In the next step the AI matches each product&apos;s current details to this list — values stay exactly as they are — and you approve every product.
                        </p>
                    </div>
                    {!editing && (
                        <button type="button" onClick={startEditing} className="rounded-lg border border-border-soft px-3 py-1.5 text-sm text-main hover:bg-panel">
                            Edit list
                        </button>
                    )}
                </div>

                {!editing && (
                    <ol className="mt-4 divide-y divide-border-soft overflow-hidden rounded-lg border border-border-soft">
                        {list.map((a, i) => (
                            <li key={a.name} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-3 py-2 text-sm">
                                <span className="text-xs text-sub">{i + 1}</span>
                                <span className="font-semibold text-main">{a.name}</span>
                                <span className="text-sub">{a.description ? `e.g. ${a.description}` : ""}</span>
                            </li>
                        ))}
                    </ol>
                )}

                {editing && (
                    <div className="mt-4 space-y-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-sub">
                            Start from a ready-made list:
                            {TEMPLATE_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setText(templateToText(preset.attributes))}
                                    className="rounded-full border border-accent/40 px-3 py-1 text-accent hover:bg-accent/10"
                                >
                                    {preset.label}
                                </button>
                            ))}
                            {text && (
                                <button type="button" onClick={() => setText("")} className="flex items-center gap-1 text-sub hover:text-main">
                                    <Trash2 className="h-3 w-3" /> Clear
                                </button>
                            )}
                        </div>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={14}
                            placeholder={"One detail per line, in the order you want. Add an example after a | sign:\nCapacity | 16GB\nMemory Type | DDR5\nMemory Speed | 6000 MT/s\n\nYou can also paste a table."}
                            className="w-full rounded-lg border border-border-soft bg-surface px-3 py-2 font-mono text-xs text-main"
                        />
                        <p className="text-xs text-sub">
                            {parsed.length} details found. The example after <code>|</code> only helps the AI recognise the right detail — product values are never changed.
                        </p>
                        {error && <p className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={save}
                                disabled={saving || parsed.length === 0}
                                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save list"}
                            </button>
                            {list.length > 0 && (
                                <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm text-sub hover:text-main">
                                    Cancel
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {list.length > 0 && !editing && notOnList.length > 0 && (
                <div className="admin-card rounded-xl p-6">
                    <h3 className="text-base font-bold text-main">Details that will be removed ({notOnList.length})</h3>
                    <p className="mt-1 text-sm text-sub">
                        Your products also use these names, but they are not on the list. They will be <strong className="text-main">removed</strong> from
                        products — unless you choose to keep them while reviewing each product. A detail that means the same as one on the list (e.g.
                        “Tested Speed” → Memory Speed) moves into it with its value unchanged.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {notOnList.map((n) => (
                            <span
                                key={n.key}
                                className="rounded-md border border-border-soft bg-surface px-2 py-1 text-xs text-sub line-through decoration-sub/50 opacity-60"
                                title={`${n.productCount} products`}
                            >
                                {n.name} <span className="no-underline">({n.productCount})</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {list.length > 0 && !editing && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={onNext}
                        className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90"
                    >
                        Next: convert products <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
