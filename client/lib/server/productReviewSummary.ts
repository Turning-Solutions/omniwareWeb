import "server-only";
import mongoose from "mongoose";
import { cache } from "react";
import { ensureDb } from "@/server/src/config/db";
import Review from "@/server/src/models/Review";
import type { ProductReviewSummary } from "@/lib/seo/productSeo";

const MAX_INLINE_REVIEWS = 3;

type ReviewDocument = {
    rating?: number;
    authorName?: string;
    comment?: string;
    createdAt?: Date;
};

/** Approved product reviews aggregated for Product JSON-LD (aggregateRating + review). */
export const fetchProductReviewSummary = cache(
    async (productId: string): Promise<ProductReviewSummary | undefined> => {
        if (!mongoose.Types.ObjectId.isValid(productId)) return undefined;

        try {
            await ensureDb();
            const reviews = await Review.find({
                kind: "product",
                productId: new mongoose.Types.ObjectId(productId),
                status: "approved",
            })
                .sort({ createdAt: -1 })
                .limit(200)
                .select("rating authorName comment createdAt")
                .lean<ReviewDocument[]>();

            const rated = reviews.filter((review) => typeof review.rating === "number");
            if (rated.length === 0) return undefined;

            const ratingValue =
                rated.reduce((sum, review) => sum + (review.rating ?? 0), 0) / rated.length;

            return {
                ratingValue,
                reviewCount: rated.length,
                reviews: rated.slice(0, MAX_INLINE_REVIEWS).map((review) => ({
                    author: review.authorName?.trim() || "Omniware customer",
                    rating: review.rating ?? 5,
                    body: review.comment?.trim() || undefined,
                    datePublished: review.createdAt
                        ? new Date(review.createdAt).toISOString().slice(0, 10)
                        : undefined,
                })),
            };
        } catch (error) {
            console.error("[seo] Failed to load product review summary:", error);
            return undefined;
        }
    }
);
