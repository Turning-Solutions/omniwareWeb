"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { isAxiosError } from "axios";

interface Product {
    _id: string;
    title: string;
    price: number;
    stock: { qty: number };
    brandId: { name: string } | null;
    categoryIds: { name: string }[] | null;
    slug: string;
    isActive: boolean;
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
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFetching, setIsFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
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
        const handle = window.setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 350);
        return () => window.clearTimeout(handle);
    }, [searchTerm]);

    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, selectedCategory, selectedBrand]);

    // Single effect: fetch products on mount and when filters/search change (avoids duplicate calls on load)
    useEffect(() => {
        fetchProducts();
    }, [selectedCategory, selectedBrand, debouncedSearchTerm, currentPage]);

    const fetchProducts = async () => {
        setIsFetching(true);
        try {
            const queryParams = new URLSearchParams({
                limit: '20',
                page: String(currentPage),
                ...(debouncedSearchTerm && { q: debouncedSearchTerm }),
                ...(selectedCategory && { category: selectedCategory }),
                ...(selectedBrand && { brand: selectedBrand })
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
        if (!confirm("Are you sure you want to delete this product?")) return;

        try {
            await api.patch(`/admin/products/${id}`, { isActive: false });
            fetchProducts();
        } catch (error) {
            console.error("Error deleting product", error);
        }
    };

    const filteredProducts = products; // Filtering handled by API now

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-main">Products</h1>
                <Link href="/admin/products/new" className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                    <Plus className="h-5 w-5" />
                    Add Product
                </Link>
            </div>

            <div className="admin-card rounded-xl p-6 mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-sub h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full bg-base border border-border-soft rounded-lg pl-10 pr-4 py-2 text-main focus:outline-none focus:border-accent transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setCurrentPage(1);
                                setDebouncedSearchTerm(searchTerm.trim());
                            }
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <select
                    className="admin-card border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-black"
                    value={selectedCategory}
                    onChange={(e) => {
                        setCurrentPage(1);
                        setSelectedCategory(e.target.value);
                    }}
                >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                </select>
                <select
                    className="admin-card border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-black"
                    value={selectedBrand}
                    onChange={(e) => {
                        setCurrentPage(1);
                        setSelectedBrand(e.target.value);
                    }}
                >
                    <option value="">All Brands</option>
                    {brands.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                </select>
            </div>

            <div className="admin-card rounded-xl overflow-hidden">
                {isFetching && !loading ? (
                    <div className="px-6 py-3 text-xs text-sub border-b border-border-soft">
                        Updating...
                    </div>
                ) : null}
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-base text-sub uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Title</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Stock</th>
                                <th className="px-6 py-4">Brand</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-soft text-main">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-sub">Loading...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center text-sub">No products found</td></tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product._id} className="hover:bg-base/50 transition-colors">
                                        <td className="px-6 py-4 font-medium">{product.title}</td>
                                        <td className="px-6 py-4">LKR {product.price.toLocaleString()}</td>
                                        <td className="px-6 py-4">{product.stock?.qty || 0}</td>
                                        <td className="px-6 py-4">{product.brandId?.name || '-'}</td>
                                        <td className="px-6 py-4">{product.categoryIds?.map(c => c.name).join(', ') || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${product.isActive ? 'bg-accent/20 text-accent' : 'bg-red-500/20 text-red-400'}`}>
                                                {product.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/admin/products/${product._id}`} className="p-2 hover:bg-base rounded-lg text-accent transition-colors">
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                                <button onClick={() => deleteProduct(product._id)} className="p-2 hover:bg-base rounded-lg text-red-400 transition-colors">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
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
        </div>
    );
}
