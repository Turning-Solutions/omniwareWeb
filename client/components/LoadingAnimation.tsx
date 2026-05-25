"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface LoadingAnimationProps {
    label?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
    /** Milliseconds to wait before showing the spinner. Defaults to 0 (show immediately). */
    delayMs?: number;
}

const iconSizeClasses: Record<NonNullable<LoadingAnimationProps["size"]>, string> = {
    sm: "h-6 w-6",
    md: "h-10 w-10",
    lg: "h-14 w-14",
};

export default function LoadingAnimation({
    label = "Loading...",
    size = "md",
    className = "",
    delayMs = 0,
}: LoadingAnimationProps) {
    const [visible, setVisible] = useState(delayMs === 0);

    useEffect(() => {
        if (delayMs === 0) return;
        const timer = setTimeout(() => setVisible(true), delayMs);
        return () => clearTimeout(timer);
    }, [delayMs]);

    if (!visible) return null;

    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 ${className}`}
            role="status"
            aria-live="polite"
            aria-label={label}
        >
            <Loader2
                className={`${iconSizeClasses[size]} animate-spin text-[#D12B28]`}
                strokeWidth={2.25}
                aria-hidden
            />
            <p className="text-sm font-medium text-[#B0B0B0]">{label}</p>
        </div>
    );
}
