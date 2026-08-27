import type { ReactNode } from "react";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<StatusTone, string> = {
    neutral: "bg-panel text-sub border-border-soft",
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-danger/15 text-danger border-danger/30",
    info: "bg-info/15 text-info border-info/30",
};

interface StatusBadgeProps {
    tone: StatusTone;
    children: ReactNode;
    className?: string;
}

export default function StatusBadge({ tone, children, className = "" }: StatusBadgeProps) {
    return (
        <span
            className={`inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses[tone]} ${className}`}
        >
            {children}
        </span>
    );
}
