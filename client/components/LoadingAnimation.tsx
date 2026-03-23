"use client";

interface LoadingAnimationProps {
    label?: string;
    size?: "sm" | "md" | "lg";
    className?: string;
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
}: LoadingAnimationProps) {
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
