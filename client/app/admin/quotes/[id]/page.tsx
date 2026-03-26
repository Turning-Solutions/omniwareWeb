"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

type QuotationItem = {
    productId?: string;
    title: string;
    qty: number;
    unitPrice: number;
};

type Quotation = {
    _id: string;
    createdAt: string;
    subtotal: number;
    currency: string;
    items: QuotationItem[];
};

export default function AdminQuotationDetailsPage() {
    const params = useParams();
    const id = typeof params?.id === "string" ? params.id : "";

    const [quote, setQuote] = useState<Quotation | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const fetchQuote = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/admin/quotes/${id}`);
                setQuote(data);
            } catch (error) {
                console.error("Failed to fetch quotation", error);
                toast.error("Failed to fetch quotation.");
            } finally {
                setLoading(false);
            }
        };

        fetchQuote();
    }, [id]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-main">Quotation Details</h1>
                    <p className="text-sub text-sm mt-1">
                        {quote ? `Quote ${quote._id}` : id ? `Quote ${id}` : ""}
                    </p>
                </div>

                <Link
                    href="/admin/quotes"
                    className="inline-flex items-center gap-2 rounded-lg border border-border-soft px-3 py-2 text-sm text-sub hover:text-main hover:bg-white/5 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to list
                </Link>
            </div>

            <div className="admin-card rounded-xl p-4 sm:p-6 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <p className="text-xs text-sub">Date/Time</p>
                        <p className="text-main font-semibold">
                            {quote ? new Date(quote.createdAt).toLocaleString() : "—"}
                        </p>
                    </div>
                    <div>
                        <p className="text-xs text-sub">Items</p>
                        <p className="text-main font-semibold">{quote ? quote.items?.length || 0 : "—"}</p>
                    </div>
                    <div>
                        <p className="text-xs text-sub">Subtotal</p>
                        <p className="text-main font-semibold">
                            {quote ? `LKR ${quote.subtotal.toLocaleString()}` : "—"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="admin-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-base text-sub uppercase text-xs">
                            <tr>
                                <th className="px-4 sm:px-6 py-4">#</th>
                                <th className="px-4 sm:px-6 py-4">Product</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Qty</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Unit</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Line Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft text-main">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sub">
                                        Loading...
                                    </td>
                                </tr>
                            ) : !quote || quote.items?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sub">
                                        No items found
                                    </td>
                                </tr>
                            ) : (
                                quote.items.map((item, idx) => (
                                    <tr key={`${item.title}-${idx}`}>
                                        <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">
                                            {idx + 1}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 min-w-[220px]">
                                            <div className="text-sm font-medium truncate" title={item.title}>
                                                {item.title}
                                            </div>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right text-sm whitespace-nowrap">
                                            {item.qty}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right text-sm whitespace-nowrap">
                                            LKR {item.unitPrice.toLocaleString()}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right text-sm whitespace-nowrap">
                                            LKR {(item.unitPrice * item.qty).toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

