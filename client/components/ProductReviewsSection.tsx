"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquareQuote } from "lucide-react";
import { DEFAULT_PRODUCT_REVIEW_PAGE_SIZE, useProductReviews } from "@/hooks/useReviews";
import ReviewList from "@/components/reviews/ReviewList";
import ReviewForm from "@/components/reviews/ReviewForm";

export default function ProductReviewsSection({ productId }: { productId: string }) {
    const [page, setPage] = useState(1);
    const pageSize = DEFAULT_PRODUCT_REVIEW_PAGE_SIZE;

    useEffect(() => {
        setPage(1);
    }, [productId]);

    const { data, isLoading, isFetching } = useProductReviews(productId, { page, pageSize });
    const reviews = data?.reviews;
    const total = data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    useEffect(() => {
        if (!data || isFetching) return;
        if (data.page !== page) setPage(data.page);
    }, [data, isFetching, page]);

    return (
        <div className="col-span-full mt-10 border-t border-white/[0.08] pt-10 md:col-span-2">
            <div className="mb-6 flex items-center gap-2">
                <MessageSquareQuote className="h-5 w-5 text-[#D12B28]" aria-hidden />
                <h2 className="text-xl font-bold tracking-tight text-[#F1F1F1] sm:text-2xl">Customer reviews</h2>
                {total > 0 ? (
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs font-medium text-[#8E8E8E]">
                        {total} {total === 1 ? "review" : "reviews"}
                    </span>
                ) : null}
            </div>
            <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,380px)] lg:items-start">
                <div className="flex min-h-0 min-w-0 flex-col gap-3">
                    <div className="scrollbar-store max-h-[min(26rem,50vh)] overflow-y-auto overflow-x-hidden rounded-2xl border border-white/[0.07] bg-[#121212]/40 p-2 sm:p-3">
                        <ReviewList
                            reviews={reviews}
                            isLoading={isLoading}
                            emptyMessage="No reviews for this product yet. Be the first to leave one."
                        />
                    </div>
                    {totalPages > 1 ? (
                        <nav
                            className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#141414]/80 px-3 py-2.5"
                            aria-label="Review pages"
                        >
                            <button
                                type="button"
                                disabled={page <= 1 || isLoading || isFetching}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-[#F1F1F1] transition hover:border-[#D12B28]/35 hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-40"
                            >
                                <ChevronLeft className="h-4 w-4" aria-hidden />
                                Previous
                            </button>
                            <span className="text-center text-xs tabular-nums text-[#8E8E8E]">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={page >= totalPages || isLoading || isFetching}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.1] bg-[#1a1a1a] px-3 py-1.5 text-xs font-semibold text-[#F1F1F1] transition hover:border-[#D12B28]/35 hover:bg-white/[0.04] disabled:pointer-events-none disabled:opacity-40"
                            >
                                Next
                                <ChevronRight className="h-4 w-4" aria-hidden />
                            </button>
                        </nav>
                    ) : null}
                </div>
                <ReviewForm variant="product" productId={productId} />
            </div>
        </div>
    );
}
