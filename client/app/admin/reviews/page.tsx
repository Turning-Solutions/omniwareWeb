"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Trash2, Check, X, Loader2, Eye, RotateCcw } from "lucide-react";
import toast from "react-hot-toast";
import {
    useAdminReviews,
    useGoogleReviewSyncStatus,
    useRefreshGoogleReviews,
    useUpdateReviewStatus,
    useDeleteAdminReview,
    type GoogleReviewSyncStatus,
    type AdminReviewRow,
} from "@/hooks/useAdminReviews";
import PageHeader from "@/components/admin/PageHeader";
import StatusBadge, { type StatusTone } from "@/components/admin/StatusBadge";

/** Normalize for display and actions (legacy docs may omit `status`). */
function moderationStatus(row: AdminReviewRow): "pending" | "approved" | "rejected" {
    const s = row.status;
    if (s === "approved" || s === "rejected" || s === "pending") return s;
    return "pending";
}

function statusTone(status: "pending" | "approved" | "rejected"): StatusTone {
    if (status === "approved") return "success";
    if (status === "pending") return "warning";
    return "danger";
}

function syncStatusTone(status: GoogleReviewSyncStatus["lastImportStatus"]): StatusTone {
    if (status === "success") return "success";
    if (status === "pending") return "warning";
    if (status === "error") return "danger";
    return "neutral";
}

function formatTimestamp(value: string | null) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleString();
}

function productLink(row: AdminReviewRow) {
    if (row.kind !== "product") return "—";
    const p = row.productId;
    if (p && typeof p === "object" && "_id" in p) {
        const slug = p.slug || p._id;
        return (
            <Link href={`/product/${slug}`} className="text-accent hover:underline" target="_blank" rel="noreferrer">
                {p.title}
            </Link>
        );
    }
    return "Product";
}

export default function AdminReviewsPage() {
    const [statusFilter, setStatusFilter] = useState("pending");
    const [kindFilter, setKindFilter] = useState("all");
    const [viewing, setViewing] = useState<AdminReviewRow | null>(null);

    const { data: reviews, isLoading, error } = useAdminReviews(statusFilter, kindFilter);
    const { data: googleSync, isLoading: isGoogleSyncLoading } = useGoogleReviewSyncStatus();
    const refreshGoogle = useRefreshGoogleReviews();
    const updateStatus = useUpdateReviewStatus();
    const deleteReview = useDeleteAdminReview();

    const handleRefreshGoogleReviews = () => {
        refreshGoogle.mutate(undefined, {
            onSuccess: () => {
                toast.success("Google reviews refreshed.");
            },
            onError: (err: unknown) => {
                const msg =
                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                    "Could not queue Google review refresh.";
                toast.error(msg);
            },
        });
    };

    const handleStatus = (id: string, status: "approved" | "rejected" | "pending") => {
        updateStatus.mutate(
            { id, status },
            {
                onSuccess: () => {
                    toast.success(`Review marked ${status}.`);
                    setViewing((v) => (v?._id === id ? null : v));
                },
                onError: (err: unknown) => {
                    const msg =
                        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                        "Update failed.";
                    toast.error(msg);
                },
            }
        );
    };

    const handleDelete = (id: string) => {
        if (!window.confirm("Delete this review permanently?")) return;
        deleteReview.mutate(id, {
            onSuccess: () => {
                toast.success("Review deleted.");
                setViewing((v) => (v?._id === id ? null : v));
            },
            onError: () => toast.error("Could not delete review."),
        });
    };

    const rowBusy = (id: string) =>
        (updateStatus.isPending && updateStatus.variables?.id === id) ||
        (deleteReview.isPending && deleteReview.variables === id);

    const viewingSt = viewing ? moderationStatus(viewing) : null;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <PageHeader
                title="Customer reviews"
                subtitle="View submissions, approve or reject them, or delete. Only approved reviews appear on the storefront."
            />

            <div className="admin-card mb-8 flex flex-wrap items-center gap-3 rounded-xl p-4">
                <div className="min-w-[14rem] flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-sub">Google review sync</span>
                        <StatusBadge tone={syncStatusTone(googleSync?.lastImportStatus || "idle")} className="capitalize">
                            {googleSync?.lastImportStatus || "idle"}
                        </StatusBadge>
                    </div>
                    <p className="text-sm text-sub">
                        {isGoogleSyncLoading
                            ? "Loading Google sync status…"
                            : `${googleSync?.reviewCount ?? 0} stored review(s). Last synced ${formatTimestamp(googleSync?.lastSyncedAt ?? null)}.`}
                    </p>
                    {googleSync?.lastError ? (
                        <p className="text-xs text-danger">{googleSync.lastError}</p>
                    ) : (
                        <p className="text-xs text-sub">
                            Requested by {googleSync?.lastRequestedBy || "—"} on{" "}
                            {formatTimestamp(googleSync?.lastRequestedAt ?? null)}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRefreshGoogleReviews}
                            disabled={refreshGoogle.isPending}
                            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
                        >
                            {refreshGoogle.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <RotateCcw className="h-4 w-4" />
                            )}
                            Refresh Google reviews
                        </button>
                        {googleSync?.sourceUrl ? (
                            <a
                                href={googleSync.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-accent hover:underline"
                            >
                                Open source page
                            </a>
                        ) : null}
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wide text-sub">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="rounded-lg border border-border-soft bg-base px-3 py-2 text-sm text-main focus:border-accent focus:outline-none"
                    >
                        <option value="all">All</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wide text-sub">Type</label>
                    <select
                        value={kindFilter}
                        onChange={(e) => setKindFilter(e.target.value)}
                        className="rounded-lg border border-border-soft bg-base px-3 py-2 text-sm text-main focus:border-accent focus:outline-none"
                    >
                        <option value="all">Shop & product</option>
                        <option value="product">Product only</option>
                        <option value="shop">Shop only</option>
                    </select>
                </div>
            </div>

            {error ? (
                <p className="text-danger">Failed to load reviews.</p>
            ) : isLoading ? (
                <div className="flex items-center gap-2 text-sub">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading…
                </div>
            ) : (
                <div className="admin-card overflow-x-auto rounded-xl">
                    <table className="w-full min-w-[800px] text-left text-sm">
                        <thead>
                            <tr className="border-b border-border-soft text-sub">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 font-medium">Author</th>
                                <th className="px-4 py-3 font-medium">Rating</th>
                                <th className="px-4 py-3 font-medium">Comment</th>
                                <th className="px-4 py-3 font-medium">Product</th>
                                <th className="px-4 py-3 font-medium">Status</th>
                                <th className="px-4 py-3 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(reviews ?? []).map((row) => {
                                const st = moderationStatus(row);
                                const busy = rowBusy(row._id);
                                return (
                                    <tr key={row._id} className="border-b border-border-soft/60 text-main">
                                        <td className="whitespace-nowrap px-4 py-3 text-sub">
                                            {new Date(row.createdAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 capitalize">{row.kind}</td>
                                        <td className="max-w-[120px] truncate px-4 py-3">{row.authorName}</td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-0.5 tabular-nums">
                                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                                {row.rating}
                                            </span>
                                        </td>
                                        <td className="max-w-[200px] px-4 py-3 text-sub">
                                            <span className="line-clamp-2">{row.comment}</span>
                                        </td>
                                        <td className="max-w-[140px] px-4 py-3 text-xs">{productLink(row)}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge tone={statusTone(st)} className="capitalize">
                                                {st}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => setViewing(row)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-border-soft bg-base px-2 py-1 text-xs text-main hover:bg-white/5 disabled:opacity-50"
                                                    title="View full review"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    <span className="hidden sm:inline">View</span>
                                                </button>
                                                {st !== "approved" ? (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => handleStatus(row._id, "approved")}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-success/40 bg-success/10 px-2 py-1 text-xs text-success hover:bg-success/20 disabled:opacity-50"
                                                    >
                                                        <Check className="h-3.5 w-3.5" />
                                                        Approve
                                                    </button>
                                                ) : null}
                                                {st !== "rejected" ? (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => handleStatus(row._id, "rejected")}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-danger/40 bg-danger/10 px-2 py-1 text-xs text-danger hover:bg-danger/20 disabled:opacity-50"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                        Reject
                                                    </button>
                                                ) : null}
                                                {st !== "pending" ? (
                                                    <button
                                                        type="button"
                                                        disabled={busy}
                                                        onClick={() => handleStatus(row._id, "pending")}
                                                        className="inline-flex items-center gap-1 rounded-lg border border-border-soft px-2 py-1 text-xs text-sub hover:bg-white/5 disabled:opacity-50"
                                                        title="Return to pending queue"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        <span className="hidden md:inline">Pending</span>
                                                    </button>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => handleDelete(row._id)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-danger/30 px-2 py-1 text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {reviews?.length === 0 ? (
                        <p className="p-8 text-center text-sub">No reviews match these filters.</p>
                    ) : null}
                </div>
            )}

            {viewing ? (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="review-modal-title"
                    onClick={() => setViewing(null)}
                >
                    <div
                        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border-soft bg-surface p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-start justify-between gap-3">
                            <h2 id="review-modal-title" className="text-lg font-semibold text-main">
                                Review detail
                            </h2>
                            <button
                                type="button"
                                onClick={() => setViewing(null)}
                                className="rounded-lg border border-border-soft px-2 py-1 text-xs text-sub hover:bg-white/5"
                            >
                                Close
                            </button>
                        </div>

                        {viewingSt ? (
                            <StatusBadge tone={statusTone(viewingSt)} className="mb-4 capitalize">
                                {viewingSt}
                            </StatusBadge>
                        ) : null}

                        <dl className="space-y-3 text-sm">
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-sub">Submitted</dt>
                                <dd className="text-main">{new Date(viewing.createdAt).toLocaleString()}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-sub">Type</dt>
                                <dd className="capitalize text-main">{viewing.kind}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-sub">Author</dt>
                                <dd className="text-main">{viewing.authorName}</dd>
                            </div>
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-sub">Rating</dt>
                                <dd className="flex items-center gap-1 text-main">
                                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                    {viewing.rating} / 5
                                </dd>
                            </div>
                            {viewing.kind === "product" ? (
                                <div>
                                    <dt className="text-xs uppercase tracking-wide text-sub">Product</dt>
                                    <dd className="text-main">{productLink(viewing)}</dd>
                                </div>
                            ) : null}
                            <div>
                                <dt className="text-xs uppercase tracking-wide text-sub">Comment</dt>
                                <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-border-soft bg-base p-3 text-main leading-relaxed">
                                    {viewing.comment}
                                </dd>
                            </div>
                        </dl>

                        <div className="mt-6 flex flex-wrap gap-2 border-t border-border-soft pt-6">
                            {viewingSt !== "approved" ? (
                                <button
                                    type="button"
                                    disabled={rowBusy(viewing._id)}
                                    onClick={() => handleStatus(viewing._id, "approved")}
                                    className="inline-flex flex-1 min-w-[7rem] items-center justify-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm font-medium text-success hover:bg-success/20 disabled:opacity-50"
                                >
                                    <Check className="h-4 w-4" />
                                    Approve
                                </button>
                            ) : null}
                            {viewingSt !== "rejected" ? (
                                <button
                                    type="button"
                                    disabled={rowBusy(viewing._id)}
                                    onClick={() => handleStatus(viewing._id, "rejected")}
                                    className="inline-flex flex-1 min-w-[7rem] items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/20 disabled:opacity-50"
                                >
                                    <X className="h-4 w-4" />
                                    Reject
                                </button>
                            ) : null}
                            {viewingSt !== "pending" ? (
                                <button
                                    type="button"
                                    disabled={rowBusy(viewing._id)}
                                    onClick={() => handleStatus(viewing._id, "pending")}
                                    className="inline-flex flex-1 min-w-[7rem] items-center justify-center gap-1.5 rounded-lg border border-border-soft px-3 py-2 text-sm text-sub hover:bg-white/5 disabled:opacity-50"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Pending
                                </button>
                            ) : null}
                            <button
                                type="button"
                                disabled={rowBusy(viewing._id)}
                                onClick={() => handleDelete(viewing._id)}
                                className="inline-flex flex-1 min-w-[7rem] items-center justify-center gap-1.5 rounded-lg border border-danger/30 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
