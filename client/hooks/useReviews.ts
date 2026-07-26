import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export type Review = {
    _id: string;
    kind: "shop" | "product";
    productId?: string | null;
    rating: number;
    authorName: string;
    comment: string;
    createdAt: string;
    status?: "pending" | "approved" | "rejected";
    /** Human relative label from Google (e.g. "3 months ago"); shown instead of createdAt when present. */
    dateText?: string;
    /** Present when loaded from Google Business (Places API). */
    source?: "google";
};

export function useShopReviews(limit = 24) {
    return useQuery({
        queryKey: ["reviews", "shop", limit],
        queryFn: async () => {
            const { data } = await api.get<{ reviews: Review[] }>("/reviews/shop", { params: { limit } });
            return data.reviews;
        },
        staleTime: 0,
        refetchOnMount: "always",
    });
}

function interleaveReviews(google: Review[], site: Review[]): Review[] {
    const out: Review[] = [];
    const n = Math.max(google.length, site.length);
    for (let i = 0; i < n; i++) {
        if (i < google.length) out.push(google[i]);
        if (i < site.length) out.push(site[i]);
    }
    return out;
}

/**
 * Approved site shop reviews plus Google Business reviews (when API is configured), interleaved for the marquee.
 *
 * `fallbackGoogleReviews` (the static snapshot bundled with the app) is used for the
 * Google portion whenever the live feed is empty — e.g. before the Google feed has been
 * synced. Without this, a single approved site review would suppress the whole static
 * Google list and the marquee would repeat one card.
 */
export function useShopReviewsForMarquee(fallbackGoogleReviews: Review[] = [], limit = 24) {
    const shopQuery = useShopReviews(limit);
    const googleQuery = useQuery({
        queryKey: ["reviews", "google"],
        queryFn: async () => {
            try {
                const { data } = await api.get<{ reviews: Review[] }>("/reviews/google");
                return data.reviews ?? [];
            } catch {
                return [];
            }
        },
        staleTime: 1000 * 60 * 30,
        retry: 1,
    });

    const data = useMemo(() => {
        const liveGoogle = googleQuery.data ?? [];
        const google = liveGoogle.length > 0 ? liveGoogle : fallbackGoogleReviews;
        return interleaveReviews(google, shopQuery.data ?? []);
    }, [googleQuery.data, shopQuery.data, fallbackGoogleReviews]);

    return {
        data,
        isLoading: shopQuery.isLoading,
        isFetching: shopQuery.isFetching || googleQuery.isFetching,
    };
}

export type ProductReviewsPage = {
    reviews: Review[];
    total: number;
    page: number;
    pageSize: number;
};

export const DEFAULT_PRODUCT_REVIEW_PAGE_SIZE = 5;

export function useProductReviews(
    productId: string | undefined,
    opts: { page: number; pageSize?: number } = { page: 1 }
) {
    const pageSize = opts.pageSize ?? DEFAULT_PRODUCT_REVIEW_PAGE_SIZE;
    return useQuery({
        queryKey: ["reviews", "product", productId, opts.page, pageSize],
        queryFn: async () => {
            const { data } = await api.get<ProductReviewsPage>(`/reviews/product/${productId}`, {
                params: { page: opts.page, pageSize },
            });
            return data;
        },
        enabled: Boolean(productId),
        staleTime: 0,
        refetchOnMount: "always",
    });
}

export function useSubmitShopReview() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: { authorName: string; rating: number; comment: string }) => {
            const { data } = await api.post<{ review: Review; message?: string }>("/reviews/shop", payload);
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["reviews", "shop"] });
        },
    });
}

export function useSubmitProductReview() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: {
            productId: string;
            authorName: string;
            rating: number;
            comment: string;
        }) => {
            const { productId, ...payload } = input;
            const { data } = await api.post<{ review: Review; message?: string }>(
                `/reviews/product/${productId}`,
                payload
            );
            return data;
        },
        onSuccess: (_data, variables) => {
            qc.invalidateQueries({ queryKey: ["reviews", "product", variables.productId] });
        },
    });
}
