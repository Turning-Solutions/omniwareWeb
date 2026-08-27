"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, DollarSign, Activity, Eye, ArrowRight, Package } from "lucide-react";
import api from "@/lib/api";
import StatCard from "@/components/admin/StatCard";
import StatusBadge, { type StatusTone } from "@/components/admin/StatusBadge";

interface DashboardSummary {
    revenue: number;
    orders: number;
    productViews: number;
    topProducts: Array<{
        productId: string;
        title: string;
        views: number;
        purchases: number;
    }>;
}

interface RecentOrder {
    id: string;
    customer: string;
    total: number;
    status: string;
}

export default function AdminPage() {
    const [summary, setSummary] = useState<DashboardSummary | null>(null);
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState('7d');

    useEffect(() => {
        fetchAnalytics();
    }, [range]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/admin/analytics/summary?range=${range}`);

            if (data.summary) {
                setSummary(data.summary);
                setRecentOrders(data.recentOrders);
            }
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !summary) {
        return (
            <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-16 text-center text-main">
                <p className="text-sm text-sub">Loading dashboard…</p>
            </div>
        );
    }

    const rangeLabel = range === "today" ? "Today" : range === "7d" ? "Last 7 days" : "Last 30 days";
    const conversionRate =
        (summary?.orders && summary.orders > 0 && summary?.productViews && summary.productViews > 0)
            ? ((summary.orders / summary.productViews) * 100).toFixed(2)
            : "0.00";

    const formatStatus = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

    const orderStatusTone = (status: string): StatusTone => {
        if (status === "paid" || status === "delivered") return "success";
        if (status === "pending") return "warning";
        return "neutral";
    };

    return (
        <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-main sm:text-3xl">Dashboard</h1>
                    <p className="mt-1 text-xs text-sub sm:text-sm">
                        Sales and store activity for {rangeLabel.toLowerCase()}.
                    </p>
                </div>
                <div className="grid w-full grid-cols-3 gap-1 rounded-lg border border-border-soft bg-base p-1 sm:flex sm:w-auto sm:gap-1">
                    {['today', '7d', '30d'].map((r) => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => setRange(r)}
                            className={`w-full rounded-md py-2 text-center text-xs font-medium transition-colors sm:w-auto sm:px-4 sm:py-1.5 sm:text-sm ${
                                range === r ? "bg-accent text-white" : "text-sub hover:text-main"
                            }`}
                        >
                            {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
                        </button>
                    ))}
                </div>
            </div>

            {loading && summary ? (
                <p className="text-xs text-sub mb-4">Refreshing analytics...</p>
            ) : null}

            {/* Stats Grid */}
            <div className="mb-8 grid grid-cols-1 gap-3 sm:mb-12 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4 xl:gap-6">
                <StatCard icon={DollarSign} label="Revenue" value={`LKR ${summary?.revenue.toLocaleString() || 0}`} />
                <StatCard icon={ShoppingBag} label="Orders" value={summary?.orders || 0} />
                <StatCard icon={Eye} label="Product Views" value={summary?.productViews || 0} />
                <StatCard icon={Activity} label="Conversion" value={`${conversionRate}%`} />
            </div>

            <div className="mb-8 sm:mb-10">
                <h2 className="mb-3 text-base font-semibold text-main sm:mb-4 sm:text-lg">Quick actions</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    <Link href="/admin/orders" className="admin-card group rounded-xl p-4 transition-colors hover:border-accent/50 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                                    <ShoppingBag className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-main">Manage orders</p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-sub">Statuses and order details.</p>
                                </div>
                            </div>
                            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-sub transition-colors group-hover:text-main" />
                        </div>
                    </Link>
                    <Link href="/admin/products" className="admin-card group rounded-xl p-4 transition-colors hover:border-accent/50 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent">
                                    <Package className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-main">Manage products</p>
                                    <p className="mt-0.5 text-xs leading-relaxed text-sub">Add, edit, and organize stock.</p>
                                </div>
                            </div>
                            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-sub transition-colors group-hover:text-main" />
                        </div>
                    </Link>
                </div>
            </div>

            <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
                <div className="admin-card flex flex-col overflow-hidden rounded-2xl">
                    <div className="flex flex-col gap-3 border-b border-border-soft p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                        <h2 className="text-lg font-bold text-main sm:text-xl">Recent Orders</h2>
                        <Link href="/admin/orders" className="text-sm font-medium text-accent hover:text-accent/80">
                            View all
                        </Link>
                    </div>
                    <div className="-mx-px flex-1 overflow-x-auto sm:mx-0">
                        <table className="w-full min-w-[28rem] text-left text-sm">
                            <thead className="bg-base text-xs uppercase tracking-wide text-sub">
                                <tr>
                                    <th className="whitespace-nowrap px-3 py-3 sm:px-6 sm:py-4">ID</th>
                                    <th className="px-3 py-3 sm:px-6 sm:py-4">Customer</th>
                                    <th className="whitespace-nowrap px-3 py-3 sm:px-6 sm:py-4">Total</th>
                                    <th className="whitespace-nowrap px-3 py-3 sm:px-6 sm:py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-soft text-main">
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-sm text-sub sm:px-6">
                                            No recent orders
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order: RecentOrder) => (
                                        <tr key={order.id} className="hover:bg-base/50">
                                            <td className="whitespace-nowrap px-3 py-3 font-mono text-xs sm:px-6 sm:py-4">
                                                {order.id.slice(-6)}
                                            </td>
                                            <td className="max-w-[8rem] truncate px-3 py-3 sm:max-w-none sm:px-6 sm:py-4" title={order.customer}>
                                                {order.customer}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 tabular-nums sm:px-6 sm:py-4">
                                                LKR {order.total.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-3 sm:px-6 sm:py-4">
                                                <StatusBadge tone={orderStatusTone(order.status)} className="max-w-full truncate text-[11px] sm:text-xs">
                                                    {formatStatus(order.status)}
                                                </StatusBadge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="admin-card flex flex-col overflow-hidden rounded-2xl">
                    <div className="border-b border-border-soft p-4 sm:p-6">
                        <h2 className="text-lg font-bold text-main sm:text-xl">Top Products</h2>
                    </div>
                    <div className="-mx-px flex-1 overflow-x-auto sm:mx-0">
                        <table className="w-full min-w-[22rem] text-left text-sm">
                            <thead className="bg-base text-xs uppercase tracking-wide text-sub">
                                <tr>
                                    <th className="px-3 py-3 sm:px-6 sm:py-4">Product</th>
                                    <th className="whitespace-nowrap px-3 py-3 text-right sm:px-6 sm:py-4">Views</th>
                                    <th className="whitespace-nowrap px-3 py-3 text-right sm:px-6 sm:py-4">Sales</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-soft text-main">
                                {!summary?.topProducts?.length ? (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-sm text-sub sm:px-6">
                                            No data available
                                        </td>
                                    </tr>
                                ) : (
                                    summary.topProducts.map((p) => (
                                        <tr key={p.productId} className="hover:bg-base/50">
                                            <td className="max-w-[11rem] px-3 py-3 sm:max-w-[16rem] sm:px-6 sm:py-4" title={p.title}>
                                                <span className="line-clamp-2 break-words">{p.title}</span>
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums sm:px-6 sm:py-4">
                                                {p.views}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums sm:px-6 sm:py-4">
                                                {p.purchases}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
