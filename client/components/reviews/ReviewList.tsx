"use client";

import type { Review } from "@/hooks/useReviews";
import StarDisplay from "./StarDisplay";

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
        return "";
    }
}

export default function ReviewList({
    reviews,
    isLoading,
    emptyMessage = "No reviews yet. Be the first to share your experience.",
}: {
    reviews: Review[] | undefined;
    isLoading?: boolean;
    emptyMessage?: string;
}) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-[#161616]" />
                ))}
            </div>
        );
    }
    if (!reviews?.length) {
        return <p className="text-sm text-[#8E8E8E]">{emptyMessage}</p>;
    }
    return (
        <ul className="space-y-4">
            {reviews.map((r) => (
                <li
                    key={r._id}
                    className="rounded-2xl border border-white/[0.07] bg-[#121212]/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-[#F1F1F1]">{r.authorName}</span>
                        <time className="text-xs text-[#6b6b6b]" dateTime={r.createdAt}>
                            {formatDate(r.createdAt)}
                        </time>
                    </div>
                    <div className="mt-2">
                        <StarDisplay rating={r.rating} />
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#B0B0B0]">{r.comment}</p>
                </li>
            ))}
        </ul>
    );
}
