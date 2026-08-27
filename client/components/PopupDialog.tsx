"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type PopupTone = "info" | "success" | "danger";

interface PopupDialogProps {
    open: boolean;
    title: string;
    message: string;
    tone?: PopupTone;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onClose: () => void;
}

const toneStyles: Record<PopupTone, { icon: typeof Info; iconClass: string; buttonClass: string }> = {
    info: {
        icon: Info,
        iconClass: "text-info",
        buttonClass: "bg-info hover:bg-info/90 text-white",
    },
    success: {
        icon: CheckCircle2,
        iconClass: "text-success",
        buttonClass: "bg-success hover:bg-success/90 text-white",
    },
    danger: {
        icon: AlertTriangle,
        iconClass: "text-danger",
        buttonClass: "bg-danger hover:bg-danger/90 text-white",
    },
};

export default function PopupDialog({
    open,
    title,
    message,
    tone = "info",
    confirmText = "OK",
    cancelText,
    onConfirm,
    onClose,
}: PopupDialogProps) {
    if (!open) return null;

    const style = toneStyles[tone];
    const Icon = style.icon;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-xl border border-border-soft bg-surface shadow-2xl">
                <div className="flex items-start gap-3 px-5 py-4 border-b border-border-soft">
                    <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${style.iconClass}`} />
                    <div>
                        <h3 className="text-base font-semibold text-main">{title}</h3>
                        <p className="mt-1 text-sm text-sub">{message}</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4">
                    {cancelText ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-border-soft px-4 py-2 text-sm text-main hover:bg-base transition-colors"
                        >
                            {cancelText}
                        </button>
                    ) : null}
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${style.buttonClass}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
