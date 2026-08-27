"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Package, User, MapPin, CreditCard, Calendar, ChevronDown, Check } from "lucide-react";
import api from "@/lib/api";
import PopupDialog from "@/components/PopupDialog";

interface OrderDetails {
    _id: string;
    user: { name: string; email: string } | null;
    customer?: { name?: string; email?: string; phone?: string };
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
    bankTransferReceipt?: {
        url?: string;
        publicId?: string;
        resourceType?: "image" | "raw";
        format?: string;
        bytes?: number;
        uploadedAt?: string;
    };
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

const STATUS_LABELS: Record<string, string> = {
    waiting_confirmation: "Waiting Confirmation",
    confirmed: "Confirmed",
    rejected: "Rejected",
    preparing: "Preparing",
    ready_for_pickup: "Ready for Pickup",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    pending: "Pending",
    paid: "Paid",
    shipped: "Shipped",
    cancelled: "Cancelled",
    refunded: "Refunded",
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
    waiting_confirmation: ["confirmed", "rejected"],
    confirmed: ["preparing", "ready_for_pickup", "out_for_delivery", "delivered", "rejected"],
    preparing: ["ready_for_pickup", "out_for_delivery", "delivered"],
    ready_for_pickup: ["delivered"],
    out_for_delivery: ["delivered"],
    delivered: [],
    rejected: [],
    pending: ["confirmed", "rejected"],
    paid: ["preparing", "ready_for_pickup", "out_for_delivery", "delivered", "rejected"],
    shipped: ["delivered"],
    cancelled: [],
    refunded: [],
};

function statusLabel(status: string): string {
    return STATUS_LABELS[status] || status.replace(/_/g, " ");
}

function normalizeReceiptUrl(url: string, publicId?: string, resourceType?: "image" | "raw"): string {
    if (!url) return "";

    // Repair older records that accidentally stored duplicated folder segments.
    const deduped = url.replace(
        "/omniware/order-receipts/omniware/order-receipts/",
        "/omniware/order-receipts/"
    );

    // If we have publicId + cloud name, build canonical delivery URL.
    try {
        const parsed = new URL(deduped);
        const cloudName = parsed.pathname.split("/")[1];
        if (cloudName && publicId) {
            const safePublicId = publicId.replace(/^\/+/, "");
            const type = resourceType === "raw" ? "raw" : "image";
            return `https://res.cloudinary.com/${cloudName}/${type}/upload/${safePublicId}`;
        }
    } catch {
        // fall through
    }
    return deduped;
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
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [statusErrorOpen, setStatusErrorOpen] = useState(false);
    const [statusMenuOpen, setStatusMenuOpen] = useState(false);
    const statusMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchOrder();
    }, [id]);

    useEffect(() => {
        const onDocMouseDown = (e: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
                setStatusMenuOpen(false);
            }
        };
        if (statusMenuOpen) {
            document.addEventListener("mousedown", onDocMouseDown);
            return () => document.removeEventListener("mousedown", onDocMouseDown);
        }
    }, [statusMenuOpen]);

    const fetchOrder = async () => {
        try {
            const { data } = await api.get(`/admin/orders/${id}`);
            setOrder(data);
        } catch (error) {
            console.error("Failed to fetch order", error);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (newStatus: string) => {
        setUpdating(true);
        try {
            await api.patch(`/admin/orders/${id}/status`, { status: newStatus });
            fetchOrder(); // Refresh
        } catch (error) {
            console.error("Error updating status", error);
            setStatusErrorOpen(true);
        } finally {
            setUpdating(false);
        }
    };

    const receiptUrl = normalizeReceiptUrl(
        order?.bankTransferReceipt?.url || "",
        order?.bankTransferReceipt?.publicId,
        order?.bankTransferReceipt?.resourceType
    );
    const isPdfReceipt =
        order?.bankTransferReceipt?.format?.toLowerCase() === "pdf" ||
        order?.bankTransferReceipt?.resourceType === "raw" ||
        /\.pdf(\?|$)/i.test(receiptUrl) ||
        /\/raw\/upload\//i.test(receiptUrl);

    if (loading) return <div className="text-center py-20 text-main">Loading Order...</div>;
    if (!order) return <div className="text-center py-20 text-danger">Order not found</div>;

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <div className="mb-8">
                <Link href="/admin/orders" className="text-sub hover:text-main flex items-center gap-2 mb-4 transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Back to Orders
                </Link>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold text-main flex items-center gap-4">
                        Order #{order._id.substring(order._id.length - 6)}
                        <span className="text-lg font-normal text-sub font-mono">({order._id})</span>
                    </h1>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2" ref={statusMenuRef}>
                            <span className="text-sm text-sub shrink-0 hidden sm:inline">Status:</span>
                            {/* Menu is `absolute` + `top-full` on this wrapper only so the panel always opens below the trigger */}
                            <div className="relative">
                                <button
                                    type="button"
                                    disabled={updating}
                                    onClick={() => setStatusMenuOpen((o) => !o)}
                                    className="admin-card inline-flex w-full min-w-[200px] items-center justify-between gap-2 rounded-lg border border-border-soft px-3 py-2 text-left text-sm font-medium text-main hover:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-50"
                                    aria-haspopup="listbox"
                                    aria-expanded={statusMenuOpen}
                                >
                                    <span>{statusLabel(order.status)}</span>
                                    <ChevronDown className={`h-4 w-4 shrink-0 text-sub transition-transform ${statusMenuOpen ? "rotate-180" : ""}`} />
                                </button>
                            {statusMenuOpen && (
                                <div
                                    className="absolute left-0 top-full z-[100] mt-1 w-full min-w-[260px] max-w-[min(100vw-2rem,320px)] origin-top overflow-hidden rounded-xl border border-border-soft bg-surface shadow-2xl ring-1 ring-black/40 md:left-auto md:right-0"
                                    role="listbox"
                                >
                                    <div className="border-b border-border-soft bg-panel/80 px-3 py-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-sub">Current</p>
                                        <p className="flex items-center gap-2 text-sm font-medium text-main mt-0.5">
                                            <Check className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                                            {statusLabel(order.status)}
                                        </p>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto py-1">
                                        {(STATUS_TRANSITIONS[order.status] || []).length === 0 ? (
                                            <p className="px-3 py-3 text-sm text-sub">No status changes available.</p>
                                        ) : (
                                            <>
                                                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sub">
                                                    Change to
                                                </p>
                                                {(STATUS_TRANSITIONS[order.status] || []).map((nextStatus) => (
                                                    <button
                                                        key={nextStatus}
                                                        type="button"
                                                        role="option"
                                                        aria-selected={false}
                                                        className="flex w-full items-center px-3 py-2.5 text-left text-sm text-main hover:bg-accent/10 focus:bg-accent/15 focus:outline-none"
                                                        onClick={() => {
                                                            setStatusMenuOpen(false);
                                                            setPendingStatus(nextStatus);
                                                        }}
                                                    >
                                                        {statusLabel(nextStatus)}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Items */}
                    <div className="admin-card rounded-xl p-6">
                        <h2 className="text-xl font-bold text-main mb-6 flex items-center gap-2">
                            <Package className="h-5 w-5 text-accent" /> Order Items
                        </h2>
                        <div className="space-y-4">
                            {order.orderItems.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-4 py-4 border-b border-border-soft last:border-0">
                                    <div className="relative h-16 w-16 bg-panel rounded-lg overflow-hidden flex-shrink-0">
                                        <Image src={item.image} alt={item.name} fill className="object-cover" sizes="64px" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-main font-medium">{item.name}</h3>
                                        <p className="text-sub text-sm">Qty: {item.qty} × LKR {item.price.toLocaleString()}</p>
                                    </div>
                                    <div className="text-main font-medium">
                                        LKR {(item.qty * item.price).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="admin-card rounded-xl p-6">
                        <h2 className="text-xl font-bold text-main mb-6">Payment Summary</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between text-sub">
                                <span>Subtotal</span>
                                <span>LKR {order.itemsPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sub">
                                <span>Shipping</span>
                                <span>LKR {order.shippingPrice.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sub">
                                <span>Tax</span>
                                <span>LKR {order.taxPrice.toLocaleString()}</span>
                            </div>
                            <div className="pt-3 border-t border-border-soft flex justify-between text-main font-bold text-lg">
                                <span>Total</span>
                                <span>LKR {order.totalPrice.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="admin-card rounded-xl p-6">
                        <h2 className="text-xl font-bold text-main mb-6 flex items-center gap-2">
                            <User className="h-5 w-5 text-accent" /> Customer
                        </h2>
                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-xs text-sub uppercase">Name</span>
                                <span className="text-main">{order.user?.name || order.customer?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-sub uppercase">Email</span>
                                <span className="text-main">{order.user?.email || order.customer?.email || 'N/A'}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-sub uppercase">Phone</span>
                                <span className="text-main">{order.customer?.phone || 'N/A'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="admin-card rounded-xl p-6">
                        <h2 className="text-xl font-bold text-main mb-6 flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-accent" /> Shipping
                        </h2>
                        <div className="space-y-1 text-sm text-sub">
                            <p>{order.shippingAddress.address}</p>
                            <p>{order.shippingAddress.city}, {order.shippingAddress.postalCode}</p>
                            <p>{order.shippingAddress.country}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border-soft">
                            <div className="flex items-center gap-2 text-sm">
                                <span className={`w-2 h-2 rounded-full ${order.isDelivered ? 'bg-accent' : 'bg-sub'}`} />
                                <span className="text-sub">
                                    {order.isDelivered
                                        ? `Delivered on ${new Date(order.deliveredAt!).toLocaleDateString()}`
                                        : 'Not Delivered'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="admin-card rounded-xl p-6">
                        <h2 className="text-xl font-bold text-main mb-6 flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-accent" /> Payment
                        </h2>
                        <div className="space-y-3">
                            <div className="flex flex-col">
                                <span className="text-xs text-sub uppercase">Method</span>
                                <span className="text-main capitalize">{order.paymentMethod}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm mt-2">
                                <span className={`w-2 h-2 rounded-full ${order.isPaid ? 'bg-accent' : 'bg-danger'}`} />
                                <span className="text-sub">
                                    {order.isPaid
                                        ? `Paid on ${new Date(order.paidAt!).toLocaleDateString()}`
                                        : 'Not Paid'}
                                </span>
                            </div>
                            {order.paymentMethod === "bank_transfer" && (
                                <div className="mt-4 rounded-lg border border-border-soft bg-panel/40 p-3">
                                    <p className="text-xs text-sub uppercase mb-2">Receipt Verification</p>
                                    {order.bankTransferReceipt?.url ? (
                                        <div className="space-y-2">
                                            <a
                                                href={receiptUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-accent hover:underline text-sm"
                                            >
                                                View uploaded receipt
                                            </a>
                                            {isPdfReceipt ? (
                                                <div className="rounded border border-border-soft bg-panel p-3 text-sm text-sub">
                                                    PDF receipt uploaded. Click View uploaded receipt to open it.
                                                </div>
                                            ) : (
                                                <div className="relative h-60 w-full rounded border border-border-soft bg-panel">
                                                    <Image
                                                        src={receiptUrl}
                                                        alt="Bank transfer receipt"
                                                        fill
                                                        className="object-contain"
                                                        sizes="(min-width: 1024px) 33vw, 100vw"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-danger">No receipt uploaded by customer.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="admin-card rounded-xl p-6">
                        <div className="flex items-center gap-2 text-sub text-sm">
                            <Calendar className="h-4 w-4" />
                            Created: {new Date(order.createdAt).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
            <PopupDialog
                open={Boolean(pendingStatus)}
                title="Change order status"
                message={pendingStatus ? `Change status to "${statusLabel(pendingStatus)}"?` : ""}
                tone="danger"
                confirmText="Confirm"
                cancelText="Cancel"
                onClose={() => setPendingStatus(null)}
                onConfirm={() => {
                    if (!pendingStatus) return;
                    const next = pendingStatus;
                    setPendingStatus(null);
                    void updateStatus(next);
                }}
            />
            <PopupDialog
                open={statusErrorOpen}
                title="Update failed"
                message="An error occurred while updating order status."
                tone="danger"
                confirmText="OK"
                onClose={() => setStatusErrorOpen(false)}
                onConfirm={() => setStatusErrorOpen(false)}
            />
        </div>
    );
}
