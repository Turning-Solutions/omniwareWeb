"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Search, FileText, Eye } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Pagination from "@/components/admin/Pagination";

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

export default function AdminQuotesPage() {
    const [quotes, setQuotes] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters + pagination (quotes-level; one row per quotation)
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchQuotes = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "20",
                ...(search && { q: search }),
            });

            const { data } = await api.get(`/admin/quotes?${params}`);
            if (data?.data) {
                setQuotes(data.data);
                setTotalPages(data.pagination?.pages || 1);
            }
        } catch (error) {
            console.error("Failed to fetch quotations", error);
            toast.error("Failed to fetch quotations.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchQuotes();
        }, 500); // debounce search

        return () => clearTimeout(timer);
    }, [search, page]);

    return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <PageHeader title="Quotations" subtitle="Review quote requests submitted by customers." />

            <div className="admin-card rounded-xl p-4 sm:p-6 mb-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 items-center">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sub h-4 w-4" />
                        <input
                            type="text"
                            placeholder="Search by product title..."
                            className="w-full bg-base border border-border-soft rounded-lg pl-10 pr-4 py-2 text-main text-sm focus:outline-none focus:border-accent"
                            value={search}
                            onChange={(e) => {
                                setPage(1);
                                setSearch(e.target.value);
                            }}
                        />
                    </div>

                    <div className="sm:col-span-1">
                        <div className="flex items-center gap-2 text-sm text-sub">
                            <FileText className="h-4 w-4" />
                            Showing quote items (quotes paginated)
                        </div>
                    </div>
                </div>
            </div>

            <div className="admin-card rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-base text-sub uppercase text-xs">
                            <tr>
                                <th className="px-4 sm:px-6 py-4">Date/Time</th>
                                <th className="px-4 sm:px-6 py-4">Quote ID</th>
                                <th className="px-4 sm:px-6 py-4">Products</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Subtotal</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft text-main">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sub">
                                        Loading...
                                    </td>
                                </tr>
                            ) : quotes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-sub">
                                        No quotations found
                                    </td>
                                </tr>
                            ) : (
                                quotes.map((quote) => (
                                    <tr key={quote._id} className="hover:bg-base/50 transition-colors">
                                        <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">{new Date(quote.createdAt).toLocaleString()}</td>
                                        <td className="px-4 sm:px-6 py-4 font-mono text-xs whitespace-nowrap">
                                            {quote._id.slice(-8).toUpperCase()}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-sm whitespace-nowrap">
                                            {quote.items?.length || 0} items
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right text-sm whitespace-nowrap">
                                            LKR {(quote.subtotal || 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <Link
                                                href={`/admin/quotes/${quote._id}`}
                                                className="inline-flex items-center justify-center p-2 hover:bg-base rounded-lg text-accent transition-colors"
                                                aria-label={`View quotation ${quote._id}`}
                                            >
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

