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
