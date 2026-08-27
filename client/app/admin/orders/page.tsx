"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Eye } from "lucide-react";
import api from "@/lib/api";
import PageHeader from "@/components/admin/PageHeader";
import StatusBadge, { type StatusTone } from "@/components/admin/StatusBadge";
import Pagination from "@/components/admin/Pagination";

interface Order {
    _id: string;
    user: { name: string; email: string } | null;
    customer?: { name?: string; email?: string; phone?: string };
    totalPrice: number;
    status: string;
    isPaid: boolean;
    isDelivered: boolean;
    createdAt: string;
    paymentMethod: string;
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [minTotal, setMinTotal] = useState("");
    const [maxTotal, setMaxTotal] = useState("");
    const [sort, setSort] = useState("newest");

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "10",
                ...(search && { search }),
                ...(status && { status }),
                ...(minTotal && { minTotal }),
                ...(maxTotal && { maxTotal }),
                ...(sort && { sort })
            });

            const { data } = await api.get(`/admin/orders?${params}`);

            if (data.data) {
                setOrders(data.data);
                setTotalPages(data.pagination.pages);
            }
        } catch (error) {
            console.error("Failed to fetch orders", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders();
        }, 500); // Debounce
        return () => clearTimeout(timer);
    }, [search, status, minTotal, maxTotal, sort, page]);

    const getStatusTone = (status: string): StatusTone => {
        switch (status) {
            case 'confirmed':
            case 'preparing':
            case 'ready_for_pickup':
            case 'out_for_delivery':
                return 'info';
            case 'delivered': return 'success';
            case 'waiting_confirmation': return 'warning';
            case 'rejected': return 'danger';
            default: return 'neutral';
        }
    };

    const formatOrderNumber = (orderId: string) => `ORD-${orderId.slice(-8).toUpperCase()}`;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <PageHeader title="Orders" subtitle="Track and manage customer orders." />

            <div className="admin-card rounded-xl p-4 sm:p-6 mb-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sub h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search ID..."
                            className="w-full bg-base border border-border-soft rounded-lg pl-10 pr-4 py-2 text-main text-sm focus:outline-none focus:border-accent"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-base border border-border-soft rounded-lg px-4 py-2 text-main text-sm focus:outline-none focus:border-accent [&>option]:text-white"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="delivered">Delivered</option>
                        <option value="out_for_delivery">Out for Delivery</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready_for_pickup">Ready for Pickup</option>
                        <option value="rejected">Rejected</option>
                        <option value="waiting_confirmation">Waiting Confirmation</option>
                    </select>
                    <select
                        className="bg-base border border-border-soft rounded-lg px-4 py-2 text-main text-sm focus:outline-none focus:border-accent [&>option]:text-white"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="total_desc">Total: High to Low</option>
                        <option value="total_asc">Total: Low to High</option>
                    </select>
                </div>
            </div>

            <div className="admin-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-base text-sub uppercase text-xs">
                            <tr>
                                <th className="px-4 sm:px-6 py-4">Order No</th>
                                <th className="px-4 sm:px-6 py-4">Customer</th>
                                <th className="px-4 sm:px-6 py-4">Date</th>
                                <th className="px-4 sm:px-6 py-4">Total</th>
                                <th className="px-4 sm:px-6 py-4">Status</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft text-main">
                            {loading ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-sub">Loading...</td></tr>
                            ) : orders.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-8 text-center text-sub">No orders found</td></tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order._id} className="hover:bg-base/50 transition-colors">
                                        <td className="px-4 sm:px-6 py-4 font-mono text-xs whitespace-nowrap">
                                            {formatOrderNumber(order._id)}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 min-w-[180px]">
                                            <div className="text-sm font-medium">
                                                {order.customer?.name || order.user?.name || 'Unknown'}
                                            </div>
                                            <div className="text-xs text-sub">
                                                {order.user?.email || order.customer?.email || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{new Date(order.createdAt).toLocaleDateString()}</td>
                                        <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">LKR {order.totalPrice.toLocaleString()}</td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                            <StatusBadge tone={getStatusTone(order.status)}>
                                                {order.status.replace(/_/g, ' ')}
                                            </StatusBadge>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <Link href={`/admin/orders/${order._id}`} className="inline-flex items-center justify-center p-2 hover:bg-base rounded-lg text-accent transition-colors">
                                                <Eye className="h-4 w-4" />
                                            </Link>
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
