"use client";

import { useEffect, useState } from "react";
import { Link2, X } from "lucide-react";

interface LinkInsertDialogProps {
    open: boolean;
    initialLabel: string;
    onCancel: () => void;
    onInsert: (label: string, url: string) => void;
}

export default function LinkInsertDialog({ open, initialLabel, onCancel, onInsert }: LinkInsertDialogProps) {
    const [label, setLabel] = useState(initialLabel);
    const [url, setUrl] = useState("");

    useEffect(() => {
        if (open) {
            setLabel(initialLabel);
            setUrl("");
        }
    }, [open, initialLabel]);

    if (!open) return null;

    const canInsert = label.trim().length > 0 && url.trim().length > 0;

    const submit = () => {
        if (!canInsert) return;
        onInsert(label.trim(), url.trim());
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-border-soft bg-surface shadow-2xl">
                <div className="flex items-center justify-between border-b border-border-soft px-5 py-4">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-main">
                        <Link2 className="h-4 w-4 text-accent" /> Insert link
                    </h3>
                    <button type="button" onClick={onCancel} className="text-sub transition-colors hover:text-main">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="rounded-lg border border-border-soft bg-base/60 px-3 py-2.5 text-xs leading-relaxed text-sub">
                        Only the <span className="text-main">text to display</span> becomes clickable, customers see that word or
                        phrase, never the raw URL. For example, display text{" "}
                        <span className="text-main">&quot;warranty terms&quot;</span> linking to your policy page shows only
                        &quot;warranty terms&quot; on the product page.
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-sub">
                            Text to display
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submit()}
                            placeholder="e.g. warranty terms"
                            className="w-full rounded-lg border border-border-soft bg-base px-3 py-2 text-sm text-main focus:border-accent focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-sub">Link URL</label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && submit()}
                            placeholder="https://example.com/page"
                            className="w-full rounded-lg border border-border-soft bg-base px-3 py-2 text-sm text-main focus:border-accent focus:outline-none"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-border-soft px-5 py-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border border-border-soft px-4 py-2 text-sm text-main transition-colors hover:bg-base"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!canInsert}
                        onClick={submit}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
                    >
                        Insert link
                    </button>
                </div>
            </div>
        </div>
    );
}
