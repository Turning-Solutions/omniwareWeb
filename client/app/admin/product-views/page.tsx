"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Eye, Package, TrendingUp } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import StatCard from "@/components/admin/StatCard";
import Pagination from "@/components/admin/Pagination";

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
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft text-main">
                            {loading ? (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-sub">Loading...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={3} className="px-6 py-8 text-center text-sub">No product views recorded for this range</td></tr>
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
        </div>
    );
}
