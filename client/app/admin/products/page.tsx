"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight, X, Star } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { isAxiosError } from "axios";
import PopupDialog from "@/components/PopupDialog";

interface Product {
    _id: string;
    title: string;
    price: number;
    dealerPrice?: number;
    stock: { qty: number };
    brandId: { name: string } | null;
    categoryIds: { name: string }[] | null;
    slug: string;
    isActive: boolean;
    isFeatured?: boolean;
}

interface Category {
    _id: string;
    name: string;
}

interface Brand {
    _id: string;
    name: string;
}

interface PaginationState {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

export default function ProductsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");
    const [featuredOnly, setFeaturedOnly] = useState(false);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);
    const [deletePopup, setDeletePopup] = useState<{ title: string; message: string; tone: "success" | "danger" } | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);
    const [pagination, setPagination] = useState<PaginationState>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 20,
    });

    // Load categories and brands once on mount (for filter dropdowns)
    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [catsRes, brandsRes] = await Promise.all([
                    api.get("/products/categories"),
                    api.get("/products/brands")
                ]);
                setCategories(catsRes.data);
                setBrands(brandsRes.data);
            } catch (err) {
                console.error("Failed to fetch filters", err);
            }
        };
        fetchFilters();
    }, []);

    useEffect(() => {
        const updatedId = searchParams?.get("updated");
        setRecentlyUpdatedId(updatedId || null);
        if (!updatedId) return;
        const timer = window.setTimeout(() => setRecentlyUpdatedId(null), 12000);
        return () => window.clearTimeout(timer);
    }, [searchParams]);

    useEffect(() => {
        const applyUpdatedSignal = (updatedId: string | null | undefined) => {
            if (!updatedId) return;
            setRecentlyUpdatedId(updatedId);
            void fetchProducts();
            window.setTimeout(() => setRecentlyUpdatedId((prev) => (prev === updatedId ? null : prev)), 12000);
        };

        const onStorage = (event: StorageEvent) => {
            if (event.key !== "admin-products-updated" || !event.newValue) return;
            try {
                const parsed = JSON.parse(event.newValue) as { productId?: string };
                applyUpdatedSignal(parsed.productId);
            } catch {
                // Ignore malformed storage payloads.
            }
        };

        const onCustomUpdated = (event: Event) => {
            const customEvent = event as CustomEvent<{ productId?: string }>;
            applyUpdatedSignal(customEvent.detail?.productId);
        };

        window.addEventListener("storage", onStorage);
        window.addEventListener("admin-products-updated", onCustomUpdated as EventListener);
        return () => {
            window.removeEventListener("storage", onStorage);
            window.removeEventListener("admin-products-updated", onCustomUpdated as EventListener);
        };
    }, [selectedCategory, selectedBrand, debouncedSearchTerm, featuredOnly, currentPage]);

    useEffect(() => {
        const handle = window.setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 350);
        return () => window.clearTimeout(handle);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, selectedCategory, selectedBrand, featuredOnly]);

    // Single effect: fetch products on mount and when filters/search change (avoids duplicate calls on load)
    useEffect(() => {
        fetchProducts();
    }, [selectedCategory, selectedBrand, debouncedSearchTerm, featuredOnly, currentPage]);

    const fetchProducts = async () => {
        setIsFetching(true);
        try {
            const queryParams = new URLSearchParams({
                limit: '20',
                page: String(currentPage),
                ...(debouncedSearchTerm && { q: debouncedSearchTerm }),
                ...(selectedCategory && { category: selectedCategory }),
                ...(selectedBrand && { brand: selectedBrand }),
                ...(featuredOnly && { isFeatured: "true" }),
                _t: String(Date.now()),
            });

            const { data } = await api.get(`/admin/products?${queryParams}`);
            // Admin products endpoint returns { data: Product[], pagination: {...} }
            const list = Array.isArray(data) ? data : data.data || [];
            setProducts(list);
            if (data?.pagination) setPagination(data.pagination);
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 401) {
                // Prevent repeated unauthorized requests with a stale token.
                localStorage.removeItem("userInfo");
                router.replace("/login");
                return;
            }
            console.error("Failed to fetch products", error);
        } finally {
            setLoading(false);
            setIsFetching(false);
        }
    };

    const deleteProduct = async (id: string) => {
        setDeletingId(id);
        try {
            await api.delete(`/admin/products/${id}`);
            setProducts((prev) => prev.filter((p) => p._id !== id));
            setPagination((prev) => ({
                ...prev,
                total: Math.max(0, prev.total - 1),
            }));
            setDeletePopup({
                title: "Product deleted",
                message: "The product was permanently deleted.",
                tone: "success",
            });
            // If the last row on a non-first page is deleted, move back one page.
            if (products.length === 1 && currentPage > 1) {
                setCurrentPage((p) => p - 1);
            } else {
                await fetchProducts();
            }
        } catch (error) {
            console.error("Error deleting product", error);
            setDeletePopup({
                title: "Action failed",
                message: "Could not deactivate this product. Please try again.",
                tone: "danger",
            });
        } finally {
            setDeletingId(null);
        }
    };

    const toggleFeatured = async (product: Product) => {
        try {
            const next = !product.isFeatured;
            setProducts((prev) =>
                prev.map((p) => (p._id === product._id ? { ...p, isFeatured: next } : p))
            );
            await api.patch(`/admin/products/${product._id}`, { isFeatured: next });
        } catch (error) {
            setProducts((prev) =>
                prev.map((p) => (p._id === product._id ? { ...p, isFeatured: product.isFeatured } : p))
            );
            console.error("Failed to update featured flag", error);
        }
    };

    const filteredProducts = products; // Filtering handled by API now
    const hasFilters = Boolean(searchTerm || selectedCategory || selectedBrand || featuredOnly);
    const activeCount = filteredProducts.filter((p) => p.isActive).length;
    const featuredCount = filteredProducts.filter((p) => p.isFeatured).length;
    const inactiveCount = filteredProducts.length - activeCount;
    const lowStockCount = filteredProducts.filter((p) => (p.stock?.qty || 0) > 0 && (p.stock?.qty || 0) <= 5).length;
    const outOfStockCount = filteredProducts.filter((p) => (p.stock?.qty || 0) === 0).length;
    const selectedCategoryName = categories.find((c) => c._id === selectedCategory)?.name;
    const selectedBrandName = brands.find((b) => b._id === selectedBrand)?.name;

    const clearFilters = () => {
        setSearchTerm("");
        setDebouncedSearchTerm("");
        setSelectedCategory("");
        setSelectedBrand("");
        setFeaturedOnly(false);
        setCurrentPage(1);
    };

    const getVisiblePages = () => {
        const totalPages = Math.max(1, pagination.pages || 1);
        const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
        return Array.from(pages)
            .filter((p) => p >= 1 && p <= totalPages)
            .sort((a, b) => a - b);
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-main">Products</h1>
                    <p className="text-sm text-sub mt-1">Search, filter, and manage your product catalog.</p>
                </div>
                <Link href="/admin/products/new" className="bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors w-full sm:w-auto">
                    <Plus className="h-5 w-5" />
                    Add Product
                </Link>
            </div>

            <div className="admin-card rounded-xl p-4 sm:p-6 mb-8">
                <div className="flex flex-col gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sub h-5 w-5" />
                        <input
                            type="text"
                            placeholder="Search by product name or SKU..."
                            className="w-full bg-base border border-border-soft rounded-lg pl-10 pr-4 py-2.5 text-main focus:outline-none focus:border-accent transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    setCurrentPage(1);
                                    setDebouncedSearchTerm(searchTerm.trim());
                                }
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_auto_auto] gap-3">
                        <select
                            className="bg-base border border-border-soft rounded-lg px-4 py-2.5 text-main focus:outline-none focus:border-accent [&>option]:text-white"
                            value={selectedCategory}
                            onChange={(e) => {
                                setCurrentPage(1);
                                setSelectedCategory(e.target.value);
                            }}
                        >
                            <option value="">All Categories</option>
                            {categories.map((c) => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                        </select>
                        <select
                            className="bg-base border border-border-soft rounded-lg px-4 py-2.5 text-main focus:outline-none focus:border-accent [&>option]:text-white"
                            value={selectedBrand}
                            onChange={(e) => {
                                setCurrentPage(1);
                                setSelectedBrand(e.target.value);
                            }}
                        >
                            <option value="">All Brands</option>
                            {brands.map((b) => (
                                <option key={b._id} value={b._id}>{b.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentPage(1);
                                setFeaturedOnly((prev) => !prev);
                            }}
                            className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                                featuredOnly
                                    ? "border-yellow-400/60 bg-yellow-500/15 text-yellow-300"
                                    : "border-border-soft text-main hover:bg-base"
                            }`}
                        >
                            <Star className="h-4 w-4" />
                            {featuredOnly ? "Featured only" : "All products"}
                        </button>
                        <button
                            type="button"
                            onClick={clearFilters}
                            disabled={!hasFilters}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-soft px-4 py-2.5 text-sm text-main disabled:opacity-50 disabled:cursor-not-allowed hover:bg-base transition-colors sm:col-span-2 xl:col-span-1"
                        >
                            <X className="h-4 w-4" />
                            Clear
                        </button>
                    </div>
                </div>
            </div>

           
            {hasFilters ? (
                <div className="mb-6 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-sub uppercase tracking-wide">Active filters</span>
                    {searchTerm ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-base text-main border border-border-soft">
                            Search: {searchTerm}
                        </span>
                    ) : null}
                    {selectedCategory ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-base text-main border border-border-soft">
                            Category: {selectedCategoryName || "Selected"}
                        </span>
                    ) : null}
                    {selectedBrand ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-base text-main border border-border-soft">
                            Brand: {selectedBrandName || "Selected"}
                        </span>
                    ) : null}
                    {featuredOnly ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-300 border border-yellow-500/25">
                            Featured only
                        </span>
                    ) : null}
                </div>
            ) : null}

            <div className="admin-card rounded-xl overflow-hidden">
                {isFetching && !loading ? (
                    <div className="px-6 py-3 text-xs text-sub border-b border-border-soft">
                        Updating...
                    </div>
                ) : null}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-base text-sub uppercase text-xs sticky top-0">
                            <tr>
                                <th className="px-4 sm:px-6 py-4">Title</th>
                                <th className="px-4 sm:px-6 py-4">Price</th>
                                <th className="px-4 sm:px-6 py-4">Dealer Price</th>
                                <th className="px-4 sm:px-6 py-4">Stock</th>
                                <th className="px-4 sm:px-6 py-4">Brand</th>
                                <th className="px-4 sm:px-6 py-4">Category</th>
                                <th className="px-4 sm:px-6 py-4">Status</th>
                                <th className="px-4 sm:px-6 py-4">Featured</th>
                                <th className="px-4 sm:px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft text-main">
                            {loading ? (
                                <tr><td colSpan={9} className="px-6 py-8 text-center text-sub">Loading...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={9} className="px-6 py-8 text-center text-sub">No products found</td></tr>
                            ) : (
                                filteredProducts.map((product) => {
                                    const isRecentlyUpdated = recentlyUpdatedId === product._id;
                                    const queryString = searchParams?.toString() || "";
                                    const returnTo = encodeURIComponent(`${pathname}${queryString ? `?${queryString}` : ""}`);
                                    return (
                                    <tr
                                        key={product._id}
                                        className={`transition-colors ${isRecentlyUpdated ? "bg-accent/10 ring-1 ring-inset ring-accent/50" : "hover:bg-base/50"}`}
                                    >
                                        <td className="px-4 sm:px-6 py-4 font-medium max-w-[260px] truncate" title={product.title}>
                                            <span>{product.title}</span>
                                            {isRecentlyUpdated ? (
                                                <span className="ml-2 inline-flex items-center rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                                                    Recently updated
                                                </span>
                                            ) : null}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">LKR {product.price.toLocaleString()}</td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                            {product.dealerPrice != null ? `LKR ${product.dealerPrice.toLocaleString()}` : "-"}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">{product.stock?.qty || 0}</td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">{product.brandId?.name || '-'}</td>
                                        <td className="px-4 sm:px-6 py-4 max-w-[260px] truncate" title={product.categoryIds?.map(c => c.name).join(', ') || '-'}>
                                            {product.categoryIds?.map(c => c.name).join(", ") || "-"}
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.isActive ? 'bg-accent/20 text-accent' : 'bg-red-500/20 text-red-400'}`}>
                                                {product.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => void toggleFeatured(product)}
                                                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                                                    product.isFeatured
                                                        ? "bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/20"
                                                        : "bg-base text-sub hover:text-main"
                                                }`}
                                            >
                                                <Star className={`h-3.5 w-3.5 ${product.isFeatured ? "fill-yellow-300 text-yellow-300" : "text-sub"}`} />
                                                {product.isFeatured ? "Featured" : "Add"}
                                            </button>
                                        </td>
                                        <td className="px-4 sm:px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/admin/products/${product._id}?returnTo=${returnTo}`} className="p-2 hover:bg-base rounded-lg text-accent transition-colors" title="Edit product">
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => setProductToDeleteId(product._id)}
                                                    disabled={deletingId === product._id}
                                                    className="p-2 hover:bg-base rounded-lg text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                    title="Delete product"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )})
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-sub">
                    Showing page {pagination.page} of {pagination.pages} ({pagination.total} products)
                </p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1 || isFetching}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-soft px-3 py-2 text-sm text-main disabled:opacity-50"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Prev
                    </button>
                    {getVisiblePages().map((pageNum, index, arr) => (
                        <span key={pageNum} className="inline-flex items-center gap-2">
                            {index > 0 && pageNum - arr[index - 1] > 1 ? (
                                <span className="text-sub px-1">...</span>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => setCurrentPage(pageNum)}
                                disabled={isFetching || pageNum === currentPage}
                                className={`min-w-9 rounded-lg border px-3 py-2 text-sm transition-colors ${
                                    pageNum === currentPage
                                        ? "border-accent bg-accent/20 text-main"
                                        : "border-border-soft text-main hover:bg-base"
                                } disabled:opacity-60`}
                            >
                                {pageNum}
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                        disabled={currentPage >= pagination.pages || isFetching}
                        className="inline-flex items-center gap-1 rounded-lg border border-border-soft px-3 py-2 text-sm text-main disabled:opacity-50"
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
            <PopupDialog
                open={Boolean(productToDeleteId)}
                title="Delete product"
                message="Are you sure you want to permanently delete this product?"
                tone="danger"
                confirmText="Delete"
                cancelText="Cancel"
                onClose={() => setProductToDeleteId(null)}
                onConfirm={() => {
                    if (!productToDeleteId) return;
                    const id = productToDeleteId;
                    setProductToDeleteId(null);
                    void deleteProduct(id);
                }}
            />
            <PopupDialog
                open={Boolean(deletePopup)}
                title={deletePopup?.title || ""}
                message={deletePopup?.message || ""}
                tone={deletePopup?.tone || "info"}
                confirmText="OK"
                onClose={() => setDeletePopup(null)}
                onConfirm={() => setDeletePopup(null)}
            />
        </div>
    );
}
