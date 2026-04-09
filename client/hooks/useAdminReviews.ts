import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import type { Review } from "@/hooks/useReviews";

/** Admin list may populate `productId` as a product document; omit base `string` to avoid intersection `never`. */
export type AdminReviewRow = Omit<Review, "productId"> & {
    productId?: { _id: string; title: string; slug?: string } | string | null;
};

export type GoogleReviewSyncStatus = {
    sourceUrl: string;
    reviewCount: number;
    lastRequestedAt: string | null;
    lastSyncedAt: string | null;
    lastImportStatus: "idle" | "pending" | "success" | "error";
    lastError: string;
    lastRequestedBy: string;
};

export function useAdminReviews(statusFilter: string, kindFilter: string) {
    return useQuery({
        queryKey: ["admin", "reviews", statusFilter, kindFilter],
        queryFn: async () => {
            const { data } = await api.get<{ reviews: AdminReviewRow[] }>("/admin/reviews", {
                params: { status: statusFilter, kind: kindFilter },
            });
            return data.reviews;
        },
    });
}

export function useGoogleReviewSyncStatus() {
    return useQuery({
        queryKey: ["admin", "google-reviews", "status"],
        queryFn: async () => {
            const { data } = await api.get<{ status: GoogleReviewSyncStatus }>("/admin/google-reviews/status");
            return data.status;
        },
    });
}

function reviewIdForUrl(id: string): string {
    const s = String(id ?? "").trim();
    return encodeURIComponent(s);
}

export function useRefreshGoogleReviews() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await api.post<{ ok: boolean; queued: boolean; status: GoogleReviewSyncStatus }>(
                "/admin/google-reviews/refresh"
            );
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin", "google-reviews"] });
            qc.invalidateQueries({ queryKey: ["reviews"] });
        },
    });
}

export function useUpdateReviewStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (input: { id: string; status: "pending" | "approved" | "rejected" }) => {
            // Query param ensures status is applied even if JSON body is not parsed when Next forwards to Express.
            const { data } = await api.post<{ review: AdminReviewRow }>(
                `/admin/reviews/${reviewIdForUrl(input.id)}/status`,
                { status: input.status },
                { params: { status: input.status } }
            );
            return data.review;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
            // Storefront lists (home strip, product pages) use these keys — refresh after moderation.
            qc.invalidateQueries({ queryKey: ["reviews"] });
        },
    });
}

export function useDeleteAdminReview() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/admin/reviews/${id}`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
            qc.invalidateQueries({ queryKey: ["reviews"] });
        },
    });
}
