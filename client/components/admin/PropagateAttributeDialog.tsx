"use client";

import { Loader2, RefreshCw } from "lucide-react";

export interface AttributeValueChangeUsage {
    field: "spec" | "attribute";
    key: string;
    groupName?: string;
    oldValue: string;
    newValue: string;
    matchedCount: number;
}

interface PropagateAttributeDialogProps {
    open: boolean;
    items: AttributeValueChangeUsage[];
    selectedIndexes: Set<number>;
    onToggle: (index: number) => void;
    onConfirm: () => void;
    onSkip: () => void;
    loading?: boolean;
}

const fieldLabel = (item: AttributeValueChangeUsage): string =>
    item.field === "spec" ? item.key.replace(/_/g, " ") : `${item.groupName} → ${item.key}`;

export default function PropagateAttributeDialog({
    open,
    items,
    selectedIndexes,
    onToggle,
    onConfirm,
    onSkip,
    loading = false,
}: PropagateAttributeDialogProps) {
    if (!open) return null;

    const selectedCount = selectedIndexes.size;
    const totalMatches = items
        .filter((_, i) => selectedIndexes.has(i))
        .reduce((sum, item) => sum + item.matchedCount, 0);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-xl border border-border-soft bg-surface shadow-2xl">
                <div className="flex items-start gap-3 px-5 py-4 border-b border-border-soft">
                    <RefreshCw className="h-5 w-5 mt-0.5 shrink-0 text-accent" />
                    <div>
                        <h3 className="text-base font-semibold text-main">Apply this correction elsewhere?</h3>
                        <p className="mt-1 text-sm text-sub">
                            This product was saved. The value{items.length !== 1 ? "s" : ""} below also{" "}
                            {items.length !== 1 ? "appear" : "appears"} on other products in the same category —
                            probably the same mistake. Choose which ones to fix everywhere.
                        </p>
                    </div>
                </div>

                <div className="max-h-80 overflow-y-auto px-5 py-3 space-y-2">
                    {items.map((item, index) => {
                        const checked = selectedIndexes.has(index);
                        return (
                            <label
                                key={`${item.field}-${item.groupName ?? ""}-${item.key}-${index}`}
                                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                                    checked ? "border-accent/40 bg-accent/10" : "border-border-soft bg-panel/40"
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => onToggle(index)}
                                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-500 text-accent focus:ring-accent"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-main">{fieldLabel(item)}</p>
                                    <p className="mt-0.5 text-sm text-sub break-words">
                                        <span className="text-danger line-through">{item.oldValue}</span>
                                        {" → "}
                                        <span className="text-success">{item.newValue}</span>
                                    </p>
                                    <p className="mt-0.5 text-xs text-sub">
                                        Found on {item.matchedCount} other product{item.matchedCount === 1 ? "" : "s"}
                                    </p>
                                </div>
                            </label>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between gap-2 px-5 py-4">
                    <span className="text-xs text-sub">
                        {selectedCount > 0
                            ? `Will update ${totalMatches} product${totalMatches === 1 ? "" : "s"}`
                            : "Nothing selected"}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onSkip}
                            disabled={loading}
                            className="rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-panel transition-colors disabled:opacity-50"
                        >
                            Just this product
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={loading || selectedCount === 0}
                            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Update {selectedCount > 0 ? totalMatches : ""} product{totalMatches === 1 ? "" : "s"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
