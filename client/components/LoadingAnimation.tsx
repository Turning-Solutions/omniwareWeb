"use client";

import { useEffect, useState } from "react";

interface LoadingAnimationProps {
    label?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
    /** Milliseconds to wait before showing the spinner. Defaults to 0 (show immediately). */
    delayMs?: number;
}

const sizeClasses: Record<NonNullable<LoadingAnimationProps["size"]>, string> = {
    sm: "h-6 w-6 border-2",
    md: "h-10 w-10 border-[3px]",
    lg: "h-14 w-14 border-4",
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
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <div className="relative">
                <div className={`${sizeClasses[size]} rounded-full border-[#5E5E5E]/40`} />
                <div
                    className={`${sizeClasses[size]} absolute inset-0 animate-spin rounded-full border-transparent border-t-[#D12B28] border-r-[#D12B28]`}
                />
            </div>
            <p className="text-sm font-medium text-[#B0B0B0]">{label}</p>
        </div>
    );
}
