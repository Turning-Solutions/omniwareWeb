"use client";

import { Star } from "lucide-react";
import type { Review } from "@/hooks/useReviews";
import googleReviewsJson from "@/data/shop-google-reviews.json";

type JsonReview = {
    id: string;
    authorName: string;
    rating: number;
    dateText?: string;
    comment: string;
};

type JsonReviewFile = {
    fetchedAt?: string;
    reviews?: JsonReview[];
};

type MarqueeReview = Review & { dateText?: string };

const parsedReviewFile = googleReviewsJson as JsonReviewFile;
const baseTimestamp = Date.parse(parsedReviewFile.fetchedAt ?? "");
const fallbackBaseMs = Number.isNaN(baseTimestamp) ? Date.now() : baseTimestamp;
const JSON_SHOP_REVIEWS: MarqueeReview[] = (parsedReviewFile.reviews ?? []).map((r, index) => ({
    _id: `json-${r.id}`,
    kind: "shop",
    rating: r.rating,
    authorName: r.authorName,
    comment: r.comment,
    createdAt: new Date(fallbackBaseMs - index * 24 * 60 * 60 * 1000).toISOString(),
    source: "google",
    dateText: r.dateText,
}));

function formatReviewDate(iso: string) {
    try {
        return new Date(iso).toLocaleString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

function Stars({ rating }: { rating: number }) {
    const n = Math.min(5, Math.max(0, Math.round(rating)));
    return (
        <span className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((i) => (
                <Star
                    key={i}
                    className={`h-4 w-4 shrink-0 sm:h-[1.125rem] sm:w-[1.125rem] ${
                        i <= n ? "fill-amber-400 text-amber-400" : "fill-white/[0.08] text-white/[0.12]"
                    }`}
                    aria-hidden
                />
            ))}
        </span>
    );
}

function ReviewMarqueeCard({ r }: { r: MarqueeReview }) {
    const dateLabel = r.dateText ?? formatReviewDate(r.createdAt);
    return (
        <article className="group flex min-h-[10.5rem] w-[min(88vw,400px)] shrink-0 flex-col rounded-xl border border-white/[0.08] bg-[#161616] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-colors duration-300 hover:border-[#D12B28]/40 hover:bg-[#1A1A1A] sm:w-[380px] sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
                <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold text-[#F1F1F1]">{r.authorName}</p>
                    <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D12B28]/75">
                        {r.source === "google" ? "Google review" : "Shop review"}
                    </p>
                </div>
                <div className="shrink-0 text-right">
                    <Stars rating={r.rating} />
                    <p className="mt-1.5 text-xs font-semibold tabular-nums text-[#c4c4c4]">{r.rating} / 5</p>
                </div>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-[#B0B0B0] line-clamp-6 sm:text-[15px] sm:leading-relaxed">
                {r.comment}
            </p>
            <time className="mt-3 block text-[11px] text-[#5c5c5c]" dateTime={r.createdAt}>
                {dateLabel}
            </time>
        </article>
    );
}

type ShopReviewsStripProps = {
    /** Edge-to-edge marquee (home page). When false, uses inset rounded panel. */
    fullWidthStrip?: boolean;
};

/** Same reviews repeated inside one segment so the row feels endless before the CSS loop. */
function marqueeSlotsForSegment(
    reviews: MarqueeReview[],
    minCards = 20
): Array<{ review: MarqueeReview; slotKey: string }> {
    if (reviews.length === 0) return [];
    const repeats = Math.max(3, Math.ceil(minCards / reviews.length));
    const slots: Array<{ review: MarqueeReview; slotKey: string }> = [];
    for (let pass = 0; pass < repeats; pass++) {
        reviews.forEach((rev, i) => {
            slots.push({ review: rev, slotKey: `${pass}-${i}-${rev._id}` });
        });
    }
    return slots;
}

/**
 * Infinite horizontal shop reviews. Default: full viewport width strip (matches partners marquee).
 */
export default function ShopReviewsStrip({ fullWidthStrip = true }: ShopReviewsStripProps) {
    const displayReviews = JSON_SHOP_REVIEWS;
    const hasReviews = displayReviews.length > 0;
    const segmentSlots = hasReviews ? marqueeSlotsForSegment(displayReviews) : [];
    const marqueeDurationSec =
        segmentSlots.length > 0
            ? Math.min(420, Math.max(160, Math.round(segmentSlots.length * 12)))
            : 120;

    const marqueeBlock = (
        <div className="relative w-full overflow-hidden py-2">
            <div
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[#0d0d0d] via-[#0d0d0d]/95 to-transparent sm:w-20 md:w-28"
                aria-hidden
            />
            <div
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#0d0d0d] via-[#0d0d0d]/95 to-transparent sm:w-20 md:w-28"
                aria-hidden
            />
            {hasReviews ? (
                <div
                    className="reviews-marquee-track flex w-max py-1"
                    style={{ animationDuration: `${marqueeDurationSec}s` }}
                >
                    {([0, 1, 2] as const).map((copyIndex) => (
                        <div
                            key={copyIndex}
                            className={`reviews-marquee-segment flex shrink-0 items-stretch gap-5 pr-5 sm:gap-6 sm:pr-6 ${copyIndex > 0 ? "reviews-marquee-segment-duplicate" : ""}`}
                            aria-hidden={copyIndex > 0 ? true : undefined}
                        >
                            {segmentSlots.map(({ review: r, slotKey }) => (
                                <ReviewMarqueeCard key={`${copyIndex}-${slotKey}`} r={r} />
                            ))}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="px-4 py-8 text-center text-sm text-[#8E8E8E] sm:px-6">
                    No shop reviews published yet.
                </p>
            )}
        </div>
    );

    if (fullWidthStrip) {
        return (
            <div className="relative w-full border-y border-white/[0.07] bg-[#0c0c0c]/95">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_8%,rgba(209,43,40,0.35)_50%,transparent_92%)]" aria-hidden />
                <div className="mx-auto max-w-7xl px-4 pb-3 pt-4 sm:px-6 lg:px-8">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#D12B28] shadow-[0_0_6px_#D12B28]" />
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                            Recent shop reviews
                        </span>
                    </div>
                </div>
                {marqueeBlock}
            </div>
        );
    }

    return (
        <div className="min-w-0">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-[#0c0c0c]/85 shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent_5%,rgba(209,43,40,0.65)_50%,transparent_95%)]" />
                <div
                    className="pointer-events-none absolute -right-20 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[#D12B28]/[0.06] blur-3xl"
                    aria-hidden
                />
                <div className="relative px-5 py-5 sm:px-7 sm:py-7 lg:px-8 lg:py-8">
                    <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-4">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[#D12B28] shadow-[0_0_6px_#D12B28]" />
                        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D12B28]/80">
                            Recent shop reviews
                        </span>
                    </div>
                    {marqueeBlock}
                </div>
            </div>
        </div>
    );
}
