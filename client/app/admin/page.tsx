"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, DollarSign, Activity, Eye, ArrowRight, Package } from "lucide-react";
import api from "@/lib/api";

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
        return <div className="p-12 text-center text-main">Loading dashboard...</div>;
    }

    const rangeLabel = range === "today" ? "Today" : range === "7d" ? "Last 7 days" : "Last 30 days";
    const conversionRate =
        (summary?.orders && summary.orders > 0 && summary?.productViews && summary.productViews > 0)
            ? ((summary.orders / summary.productViews) * 100).toFixed(2)
            : "0.00";

    const formatStatus = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-main">Dashboard</h1>
                    <p className="text-sub mt-1 text-sm">A quick snapshot of sales and store activity for {rangeLabel.toLowerCase()}.</p>
                </div>
                <div className="flex w-full sm:w-auto bg-base rounded-lg p-1 border border-border-soft overflow-x-auto">
                    {['today', '7d', '30d'].map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors shrink-0 ${range === r ? 'bg-accent text-white' : 'text-sub hover:text-main'}`}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 mb-12">
                <div className="admin-card p-5 sm:p-6 rounded-xl flex items-center space-x-4 shadow-sm">
                    <div className="h-12 w-12 bg-accent/20 text-accent rounded-lg flex items-center justify-center">
                        <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-sub">Revenue</p>
                        <h3 className="text-2xl font-bold text-main">LKR {summary?.revenue.toLocaleString() || 0}</h3>
                    </div>
                </div>
                <div className="admin-card p-5 sm:p-6 rounded-xl flex items-center space-x-4 shadow-sm">
                    <div className="h-12 w-12 bg-accent/20 text-accent rounded-lg flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-sub">Orders</p>
                        <h3 className="text-2xl font-bold text-main">{summary?.orders || 0}</h3>
                    </div>
                </div>
                <div className="admin-card p-5 sm:p-6 rounded-xl flex items-center space-x-4 shadow-sm">
                    <div className="h-12 w-12 bg-accent/20 text-accent rounded-lg flex items-center justify-center">
                        <Eye className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-sub">Product Views</p>
                        <h3 className="text-2xl font-bold text-main">{summary?.productViews || 0}</h3>
                    </div>
                </div>
                <div className="admin-card p-5 sm:p-6 rounded-xl flex items-center space-x-4 shadow-sm">
                    <div className="h-12 w-12 bg-accent/20 text-accent rounded-lg flex items-center justify-center">
                        <Activity className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm text-sub">Conversion Rate</p>
                        <h3 className="text-2xl font-bold text-main">{conversionRate}%</h3>
                    </div>
                </div>
            </div>

            <div className="mb-10">
                <h2 className="text-lg font-semibold text-main mb-4">Quick actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/admin/orders" className="admin-card p-5 rounded-xl hover:border-accent/50 transition-colors group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-accent/20 text-accent rounded-lg flex items-center justify-center">
                                    <ShoppingBag className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-main">Manage orders</p>
                                    <p className="text-xs text-sub">Update order statuses and view details.</p>
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-sub group-hover:text-main transition-colors" />
                        </div>
                    </Link>
                    <Link href="/admin/products" className="admin-card p-5 rounded-xl hover:border-accent/50 transition-colors group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-accent/20 text-accent rounded-lg flex items-center justify-center">
                                    <Package className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="font-semibold text-main">Manage products</p>
                                    <p className="text-xs text-sub">Add, edit, and organize inventory.</p>
                                </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-sub group-hover:text-main transition-colors" />
                        </div>
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <div className="admin-card rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border-soft flex justify-between items-center">
                        <h2 className="text-xl font-bold text-main">Recent Orders</h2>
                        <Link href="/admin/orders" className="text-sm text-accent hover:text-accent/80">View All</Link>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-base text-sub uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Total</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-soft text-main">
                                {recentOrders.length === 0 ? (
                                    <tr><td colSpan={4} className="p-6 text-center text-sub">No recent orders</td></tr>
                                ) : (
                                    recentOrders.map((order: RecentOrder) => (
                                        <tr key={order.id} className="hover:bg-base/50">
                                            <td className="px-6 py-4 font-mono text-xs">{order.id.slice(-6)}</td>
                                            <td className="px-6 py-4">{order.customer}</td>
                                            <td className="px-6 py-4">LKR {order.total.toLocaleString()}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'paid' || order.status === 'delivered' ? 'bg-accent/20 text-accent' : order.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-base text-sub'}`}>
                                                    {formatStatus(order.status)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="admin-card rounded-2xl overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-border-soft">
                        <h2 className="text-xl font-bold text-main">Top Products</h2>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left">
                            <thead className="bg-base text-sub uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4">Product</th>
                                    <th className="px-6 py-4 text-right">Views</th>
                                    <th className="px-6 py-4 text-right">Sales</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-soft text-main">
                                {summary?.topProducts?.length === 0 ? (
                                    <tr><td colSpan={3} className="p-6 text-center text-sub">No data available</td></tr>
                                ) : (
                                    summary?.topProducts?.map((p) => (
                                        <tr key={p.productId} className="hover:bg-base/50">
                                            <td className="px-6 py-4 max-w-[200px] truncate" title={p.title}>{p.title}</td>
                                            <td className="px-6 py-4 text-right">{p.views}</td>
                                            <td className="px-6 py-4 text-right">{p.purchases}</td>
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
