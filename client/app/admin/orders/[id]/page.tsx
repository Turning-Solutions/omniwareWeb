"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Package, User, MapPin, CreditCard, Calendar } from "lucide-react";

interface OrderDetails {
    _id: string;
    user: { name: string; email: string } | null;
    orderItems: Array<{
        name: string;
        qty: number;
        price: number;
        image: string;
        product: string;
    }>;
    shippingAddress: {
        address: string;
        city: string;
        postalCode: string;
        country: string;
    };
    paymentMethod: string;
    itemsPrice: number;
    taxPrice: number;
    shippingPrice: number;
    totalPrice: number;
    isPaid: boolean;
    paidAt?: string;
    isDelivered: boolean;
    deliveredAt?: string;
    status: string;
    createdAt: string;
}

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function AdminOrderDetailsPage({ params }: PageProps) {
    const { id } = use(params);
    const [order, setOrder] = useState<OrderDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/v1/admin/orders/${id}`);
            if (res.ok) {
                const data = await res.json();
                setOrder(data);
            }
        } catch (error) {
            console.error("Failed to fetch order", error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (newStatus: string) => {
        if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;

        setUpdating(true);
        try {
            const res = await fetch(`/api/v1/admin/orders/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                fetchOrder(); // Refresh
            } else {
                alert("Failed to update status");
            }
        } catch (error) {
            alert("Error updating status");
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-white">Loading Order...</div>;
    if (!order) return <div className="text-center py-20 text-red-500">Order not found</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8">
                <Link href="/admin/orders" className="text-gray-400 hover:text-white flex items-center gap-2 mb-4 transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Orders
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold text-white flex items-center gap-4">
                        Order #{order._id.substring(order._id.length - 6)}
                        <span className="text-lg font-normal text-gray-500 font-mono">({order._id})</span>
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="bg-white/5 border border-white/10 rounded-lg px-2">
                            <span className="text-sm text-gray-400 mr-2">Status:</span>
                            <select
                                value={order.status}
                                onChange={(e) => updateStatus(e.target.value)}
                                disabled={updating}
                                className="bg-transparent text-white font-medium py-2 focus:outline-none [&>option]:text-black"
                            >
                                <option value="pending">Pending</option>
                                <option value="paid">Paid</option>
                                <option value="shipped">Shipped</option>
                                <option value="delivered">Delivered</option>
                                <option value="cancelled">Cancelled</option>
                                <option value="refunded">Refunded</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Items */}
                    <div className="glass rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-400" /> Order Items
                        </h2>
                        <div className="space-y-4">
                            {order.orderItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 py-4 border-b border-white/5 last:border-0">
                                    <div className="h-16 w-16 bg-white/5 rounded-lg overflow-hidden flex-shrink-0">
                                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-white font-medium">{item.name}</h3>
                                        <p className="text-gray-400 text-sm">Qty: {item.qty} × LKR {item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="text-white font-medium">
                                        LKR {(item.qty * item.price).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="glass rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6">Payment Summary</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-gray-300">
                                <span>Subtotal</span>
                                <span>LKR {order.itemsPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>Shipping</span>
                                <span>LKR {order.shippingPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-gray-300">
                                <span>Tax</span>
                                <span>LKR {order.taxPrice.toLocaleString()}</span>
                            </div>
                            <div className="pt-3 border-t border-white/10 flex justify-between text-white font-bold text-lg">
                                <span>Total</span>
                                <span>LKR {order.totalPrice.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-8">
                    {/* Customer */}
                    <div className="glass rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <User className="h-5 w-5 text-purple-400" /> Customer
                        </h2>
                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase">Name</span>
                                <span className="text-white">{order.user?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase">Email</span>
                                <span className="text-white">{order.user?.email || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Shipping */}
                    <div className="glass rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-red-400" /> Shipping
                        </h2>
                        <div className="space-y-1 text-sm text-gray-300">
                            <p>{order.shippingAddress.address}</p>
                            <p>{order.shippingAddress.city}, {order.shippingAddress.postalCode}</p>
                            <p>{order.shippingAddress.country}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <div className="flex items-center gap-2 text-sm">
                                <span className={`w-2 h-2 rounded-full ${order.isDelivered ? 'bg-green-500' : 'bg-gray-500'}`} />
                                <span className="text-gray-300">
                                    {order.isDelivered
                                        ? `Delivered on ${new Date(order.deliveredAt!).toLocaleDateString()}`
                                        : 'Not Delivered'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className="glass rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-green-400" /> Payment
                        </h2>
                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-xs text-gray-500 uppercase">Method</span>
                                <span className="text-white capitalize">{order.paymentMethod}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm mt-2">
                                <span className={`w-2 h-2 rounded-full ${order.isPaid ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className="text-gray-300">
                                    {order.isPaid
                                        ? `Paid on ${new Date(order.paidAt!).toLocaleDateString()}`
                                        : 'Not Paid'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Meta */}
                    <div className="glass rounded-xl p-6">
                        <div className="flex items-center gap-2 text-gray-400 text-sm">
                            <Calendar className="h-4 w-4" />
                            Created: {new Date(order.createdAt).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
