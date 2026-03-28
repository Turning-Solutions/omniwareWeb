"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import toast from "react-hot-toast";
import { useSubmitProductReview, useSubmitShopReview } from "@/hooks/useReviews";

type ReviewFormProps = {
    variant: "shop" | "product";
    productId?: string;
    className?: string;
    /** Wide grid: name + rating row, full-width comment (e.g. home page). Hides visible title — use a section label outside. */
    wide?: boolean;
};

export default function ReviewForm({ variant, productId, className = "", wide = false }: ReviewFormProps) {
    const [authorName, setAuthorName] = useState("");
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");

    const shopMutation = useSubmitShopReview();
    const productMutation = useSubmitProductReview();
    const pending = variant === "shop" ? shopMutation.isPending : productMutation.isPending;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const name = authorName.trim();
        const text = comment.trim();
        if (!name) {
            toast.error("Please enter your name.");
            return;
        }
        if (!text) {
            toast.error("Please write a short review.");
            return;
        }
        const payload = { authorName: name, rating, comment: text };
        const onDone = (res: { message?: string }) => {
            toast.success(res.message ?? "Thanks — your review was submitted.");
            setAuthorName("");
            setComment("");
            setRating(5);
        };
        const onErr = (err: unknown) => {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                "Could not submit review.";
            toast.error(msg);
        };

        if (variant === "shop") {
            shopMutation.mutate(payload, {
                onSuccess: (data) => onDone(data),
                onError: onErr,
            });
        } else if (productId) {
            productMutation.mutate(
                { productId, ...payload },
                {
                    onSuccess: (data) => onDone(data),
                    onError: onErr,
                }
            );
        }
    };

    const fieldsWide = (
        <>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8 xl:grid-cols-12 xl:gap-10">
                <div className="xl:col-span-4">
                    <label htmlFor="review-name" className="mb-1 block text-xs text-[#8E8E8E]">
                        Your name
                    </label>
                    <input
                        id="review-name"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        maxLength={100}
                        className="w-full rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3 py-2.5 text-sm text-[#F1F1F1] outline-none transition focus:border-[#D12B28]/45"
                        placeholder="e.g. Alex"
                        autoComplete="name"
                    />
                </div>
                <div className="xl:col-span-4">
                    <span className="mb-2 block text-xs text-[#8E8E8E]">Rating</span>
                    <div className="flex flex-wrap gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setRating(n)}
                                className="rounded-lg p-1 transition hover:bg-white/5"
                                aria-label={`${n} stars`}
                            >
                                <Star
                                    className={n <= rating ? "fill-amber-400 text-amber-400" : "text-[#555]"}
                                    size={28}
                                    strokeWidth={n <= rating ? 0 : 1.5}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            <div>
                <label htmlFor="review-comment" className="mb-1 block text-xs text-[#8E8E8E]">
                    Comment
                </label>
                <textarea
                    id="review-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={wide ? 5 : 4}
                    maxLength={2000}
                    className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3 py-2.5 text-sm text-[#F1F1F1] outline-none transition focus:border-[#D12B28]/45 sm:text-[15px]"
                    placeholder="Share your experience…"
                />
            </div>
            <button
                type="submit"
                disabled={pending || (variant === "product" && !productId)}
                className={`rounded-xl bg-[#D12B28] text-sm font-bold text-white shadow-lg shadow-[#D12B28]/20 transition hover:bg-[#B32522] disabled:opacity-60 ${wide ? "self-start px-5 py-2.5" : "w-full py-3"}`}
            >
                {pending ? "Submitting…" : "Submit review"}
            </button>
        </>
    );

    const fieldsStack = (
        <div className="space-y-4">
            <div>
                <label htmlFor="review-name" className="mb-1 block text-xs text-[#8E8E8E]">
                    Your name
                </label>
                <input
                    id="review-name"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3 py-2.5 text-sm text-[#F1F1F1] outline-none transition focus:border-[#D12B28]/45"
                    placeholder="e.g. Alex"
                    autoComplete="name"
                />
            </div>
            <div>
                <span className="mb-2 block text-xs text-[#8E8E8E]">Rating</span>
                <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                        <button
                            key={n}
                            type="button"
                            onClick={() => setRating(n)}
                            className="rounded-lg p-1 transition hover:bg-white/5"
                            aria-label={`${n} stars`}
                        >
                            <Star
                                className={n <= rating ? "fill-amber-400 text-amber-400" : "text-[#555]"}
                                size={28}
                                strokeWidth={n <= rating ? 0 : 1.5}
                            />
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <label htmlFor="review-comment" className="mb-1 block text-xs text-[#8E8E8E]">
                    Comment
                </label>
                <textarea
                    id="review-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                    maxLength={2000}
                    className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#0c0c0c] px-3 py-2.5 text-sm text-[#F1F1F1] outline-none transition focus:border-[#D12B28]/45"
                    placeholder="Share your experience…"
                />
            </div>
            <button
                type="submit"
                disabled={pending || (variant === "product" && !productId)}
                className="w-full rounded-xl bg-[#D12B28] py-3 text-sm font-bold text-white shadow-lg shadow-[#D12B28]/20 transition hover:bg-[#B32522] disabled:opacity-60"
            >
                {pending ? "Submitting…" : "Submit review"}
            </button>
        </div>
    );

    return (
        <form
            onSubmit={handleSubmit}
            className={`rounded-2xl border border-white/[0.08] bg-[#121212]/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${wide ? "!border-0 !bg-transparent !p-0 !shadow-none" : ""} ${className}`}
        >
            {wide ? (
                <>
                    <h2 className="sr-only">Write a review</h2>
                    <div className="flex flex-col gap-6">{fieldsWide}</div>
                </>
            ) : (
                <>
                    <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D12B28]/85">
                        Write a review
                    </p>
                    {fieldsStack}
                </>
            )}
        </form>
    );
}
