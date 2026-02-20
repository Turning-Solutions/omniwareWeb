"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Filter, Eye, ArrowUpDown } from "lucide-react";

interface Order {
    _id: string;
    user: { name: string; email: string } | null;
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

            const res = await fetch(`/api/v1/admin/orders?${params}`, {
                headers: {
                    // "Authorization": ... // Auth disabled
                }
            });
            const data = await res.json();

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'text-green-400 bg-green-400/10';
            case 'delivered': return 'text-green-400 bg-green-400/10';
            case 'shipped': return 'text-blue-400 bg-blue-400/10';
            case 'pending': return 'text-yellow-400 bg-yellow-400/10';
            case 'cancelled': return 'text-red-400 bg-red-400/10';
            default: return 'text-gray-400 bg-gray-400/10';
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-main">Orders</h1>
            </div>

            <div className="admin-card rounded-xl p-6 mb-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        className="bg-base border border-border-soft rounded-lg px-4 py-2 text-main text-sm focus:outline-none focus:border-accent [&>option]:text-black"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                        className="bg-base border border-border-soft rounded-lg px-4 py-2 text-main text-sm focus:outline-none focus:border-accent [&>option]:text-black"
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
                                <th className="px-6 py-4">Order ID</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
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
                                        <td className="px-6 py-4 font-mono text-xs">{order._id}</td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium">{order.user?.name || 'Unknown'}</div>
                                            <div className="text-xs text-sub">{order.user?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-sm">LKR {order.totalPrice.toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
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
                <div className="p-4 border-t border-border-soft flex justify-center gap-2">
                    <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 rounded bg-base hover:bg-base/80 disabled:opacity-50 text-sm text-main">
                        Prev
                    </button>
                    <span className="px-3 py-1 text-sm text-sub">Page {page} of {totalPages}</span>
                    <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="px-3 py-1 rounded bg-base hover:bg-base/80 disabled:opacity-50 text-sm text-main">
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
