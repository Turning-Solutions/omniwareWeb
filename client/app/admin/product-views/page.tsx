"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Eye, Package, TrendingUp, RotateCcw } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import Pagination from "@/components/admin/Pagination";
import PopupDialog from "@/components/PopupDialog";

interface ProductViewRow {
    productId: string;
    title: string;
    slug?: string;
    image?: string;
    price?: number;
    views: number;
    lastViewedAt: string;
    isActive?: boolean;
}

interface Totals {
    totalViews: number;
    distinctProducts: number;
    topProduct: ProductViewRow | null;
}

export default function AdminProductViewsPage() {
    const [rows, setRows] = useState<ProductViewRow[]>([]);
    const [totals, setTotals] = useState<Totals>({ totalViews: 0, distinctProducts: 0, topProduct: null });
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [range, setRange] = useState("30d");

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [productToResetId, setProductToResetId] = useState<string | null>(null);
    const [resettingId, setResettingId] = useState<string | null>(null);
    const [resultPopup, setResultPopup] = useState<{ title: string; message: string; tone: "success" | "danger" } | null>(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
                range,
                ...(search && { search }),
            });

            const { data } = await api.get(`/admin/analytics/product-views?${params}`);

            setRows(data.data || []);
            setTotalPages(data.pagination?.pages || 1);
            setTotals(data.totals || { totalViews: 0, distinctProducts: 0, topProduct: null });
        } catch (error) {
            console.error("Failed to fetch product view stats", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchStats();
        }, 500); // Debounce
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, range, page]);

    useEffect(() => {
        setPage(1);
    }, [search, range]);

    const resetViews = async (productId: string) => {
        setResettingId(productId);
        try {
            await api.post(`/admin/products/${productId}/reset-views`);
            setResultPopup({
                title: "Views reset",
                message: "This product's view count has been reset to 0.",
                tone: "success",
            });
            await fetchStats();
        } catch (error) {
            console.error("Failed to reset product views", error);
            setResultPopup({
                title: "Reset failed",
                message: "Couldn't reset the view count. Please try again.",
                tone: "danger",
            });
        } finally {
            setResettingId(null);
        }
    };

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <PageHeader title="Product Views" subtitle="See which products get the most visits." />

            <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <StatCard icon={Eye} label="Total Views" value={totals.totalViews} />
                <StatCard icon={Package} label="Products Viewed" value={totals.distinctProducts} />
                <StatCard
                    icon={TrendingUp}
                    label="Most Visited"
                    value={<span className="block truncate text-sm sm:text-base">{totals.topProduct?.title || "—"}</span>}
                />
            </div>

            <div className="admin-card rounded-xl p-4 sm:p-6 mb-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sub h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search product name..."
                            className="w-full bg-panel border border-border-soft rounded-lg pl-10 pr-4 py-2 text-main text-sm focus:outline-none focus:border-accent"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-panel border border-border-soft rounded-lg px-4 py-2 text-main text-sm focus:outline-none focus:border-accent [&>option]:text-white"
                        value={range}
                        onChange={(e) => setRange(e.target.value)}
                    >
                        <option value="today">Today</option>
                        <option value="7d">Last 7 days</option>
                        <option value="30d">Last 30 days</option>
                        <option value="all">All time</option>
                    </select>
                </div>
            </div>

            <div className="admin-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-panel text-sub uppercase text-xs">
                            <tr>
                                <th className="px-4 sm:px-6 py-4">Product</th>
                                <th className="px-4 sm:px-6 py-4">Views</th>
                                <th className="px-4 sm:px-6 py-4">Last Viewed</th>
                                <th className="px-4 sm:px-6 py-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft text-main">
                            {loading ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-sub">Loading...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center text-sub">No product views recorded for this range</td></tr>
                            ) : (
                                rows.map((row) => (
                                    <tr key={row.productId} className="hover:bg-panel/50 transition-colors">
                                        <td className="px-4 sm:px-6 py-4 min-w-[220px]">
                                            <Link
                                                href={`/product/${row.slug || row.productId}`}
                                                target="_blank"
                                                className="flex items-center gap-3 group"
                                            >
                                                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border-soft bg-panel">
                                                    {row.image ? (
                                                        <Image src={row.image} alt="" fill className="object-contain" unoptimized />
                                                    ) : null}
                                                </div>
                                                <span className="text-sm font-medium group-hover:text-accent transition-colors">
                                                    {row.title}
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-sm font-semibold tabular-nums whitespace-nowrap">
                                            {row.views}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-sm text-sub whitespace-nowrap">
                                            {new Date(row.lastViewedAt).toLocaleString()}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => setProductToResetId(row.productId)}
                                                disabled={resettingId === row.productId}
                                                className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft px-3 py-1.5 text-xs font-medium text-sub hover:text-main hover:bg-panel transition-colors disabled:opacity-50"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                                Reset
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="border-t border-border-soft p-4">
                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
                </div>
            </div>

            <PopupDialog
                open={Boolean(productToResetId)}
                title="Reset view count"
                message="This permanently clears all recorded views for this product. This can't be undone."
                tone="danger"
                confirmText="Reset"
                cancelText="Cancel"
                onClose={() => setProductToResetId(null)}
                onConfirm={() => {
                    if (!productToResetId) return;
                    const id = productToResetId;
                    setProductToResetId(null);
                    void resetViews(id);
                }}
            />

            <PopupDialog
                open={Boolean(resultPopup)}
                title={resultPopup?.title || ""}
                message={resultPopup?.message || ""}
                tone={resultPopup?.tone || "info"}
                confirmText="OK"
                onClose={() => setResultPopup(null)}
                onConfirm={() => setResultPopup(null)}
            />
        </div>
    );
}
