"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import Link from "next/link";

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

export default function ProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [selectedCategory, setSelectedCategory] = useState("");
    const [selectedBrand, setSelectedBrand] = useState("");

    useEffect(() => {
        const fetchFilters = async () => {
            try {
                const [catsRes, brandsRes] = await Promise.all([
                    fetch(`/api/v1/products/categories`),
                    fetch(`/api/v1/products/brands`)
                ]);
                setCategories(await catsRes.json());
                setBrands(await brandsRes.json());
            } catch (err) {
                console.error("Failed to fetch filters", err);
            }
        };
        fetchFilters();
        fetchProducts();
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [selectedCategory, selectedBrand, searchTerm]); // Refetch when filters or search term change

    const fetchProducts = async () => {
        try {
            const queryParams = new URLSearchParams({
                limit: '1000',
                q: searchTerm,
                ...(selectedCategory && { category: selectedCategory }),
                ...(selectedBrand && { brand: selectedBrand })
            });

            const res = await fetch(
                `/api/v1/admin/products?${queryParams}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${JSON.parse(localStorage.getItem("userInfo") || "{}").token || ""
                            }`,
                    },
                    credentials: "include",
                }
            );
            const data = await res.json();
            // Admin products endpoint returns { data: Product[], pagination: {...} }
            const list = Array.isArray(data) ? data : data.data || [];
            setProducts(list);
        } catch (error) {
            console.error("Failed to fetch products", error);
        } finally {
            setLoading(false);
        }
    };

    const deleteProduct = async (id: string) => {
        if (!confirm("Are you sure you want to delete this product?")) return;

        try {
            // Note: In a real app we might soft delete or use a specific delete endpoint
            // For now, toggle isActive to false if no delete endpoint exists, or assume there is one.
            // Based on task, we need CRUD. Let's assume we need to implement DELETE if not present.
            // Checking routes, I saw 'updateProduct', 'createProduct'. I didn't see explicit DELETE.
            // I'll implement soft delete by toggling isActive via update.
            const res = await fetch(`/api/v1/admin/products/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${JSON.parse(localStorage.getItem('userInfo') || '{}').token}`
                },
                body: JSON.stringify({ isActive: false })
            });

            if (res.ok) {
                fetchProducts();
            } else {
                alert("Failed to delete product");
            }
        } catch (error) {
            console.error("Error deleting product", error);
        }
    };

    const filteredProducts = products; // Filtering handled by API now

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-white">Products</h1>
                <Link href="/admin/products/new" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors">
                    <Plus className="h-5 w-5" />
                    Add Product
                </Link>
            </div>

            <div className="glass rounded-xl p-6 mb-8">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors"
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            // Debounce or just search on enter? For now let's just trigger on change by adding it to dependency or refetch
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') fetchProducts();
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <select
                    className="glass border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 [&>option]:text-black"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    <option value="">All Categories</option>
                    {categories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                </select>

                <select
                    className="glass border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 [&>option]:text-black"
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                >
                    <option value="">All Brands</option>
                    {brands.map(b => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                </select>
            </div>

            <div className="glass rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/5 text-gray-400 uppercase text-xs">
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
                        <tbody className="divide-y divide-white/10 text-gray-300">
                            {loading ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center">Loading...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-8 text-center">No products found</td></tr>
                            ) : (
                                filteredProducts.map((product) => (
                                    <tr key={product._id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-medium text-white">{product.title}</td>
                                        <td className="px-6 py-4">LKR {product.price.toLocaleString()}</td>
                                        <td className="px-6 py-4">{product.stock?.qty || 0}</td>
                                        <td className="px-6 py-4">{product.brandId?.name || '-'}</td>
                                        <td className="px-6 py-4">
                                            {product.categoryIds?.map(c => c.name).join(', ') || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${product.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {product.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Link href={`/admin/products/${product._id}`} className="p-2 hover:bg-white/10 rounded-lg text-blue-400 transition-colors">
                                                    <Edit className="h-4 w-4" />
                                                </Link>
                                                <button
                                                    onClick={() => deleteProduct(product._id)}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-red-400 transition-colors"
                                                >
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
        </div >
    );
}
