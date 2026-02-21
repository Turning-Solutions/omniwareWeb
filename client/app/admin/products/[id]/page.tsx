"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Trash2, Edit2, Plus, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Brand {
    _id: string;
    name: string;
}

interface Category {
    _id: string;
    name: string;
    slug?: string;
}

interface Attribute {
    name: string;
    value: string;
}

interface FilterSpec {
    key: string;
    value: string;
}

/** Match server normalizeSpecKey so stored keys align with shop filter facet keys */
function normalizeSpecKey(key: string): string {
    if (!key) return "";
    return key
        .replace(/[_\-\/\\]+/g, " ")
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("_");
}

export default function ProductFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const isNew = id === 'new';

    const [formData, setFormData] = useState({
        title: "",
        price: "",
        sku: "",
        slug: "",
        stock: "",
        description: "",
        brandId: "",
        categoryIds: [] as string[],
        attributes: [] as Attribute[],
        filterSpecs: [] as FilterSpec[],
        isActive: true
    });

    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [featuredSpecKeys, setFeaturedSpecKeys] = useState<string[]>([]);
    const [featuredSpecsLoading, setFeaturedSpecsLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [brandsRes, categoriesRes] = await Promise.all([
                    fetch(`/api/v1/products/brands`),
                    fetch(`/api/v1/products/categories`)
                ]);
                setBrands(await brandsRes.json());
                setCategories(await categoriesRes.json());
            } catch (error) {
                console.error("Error fetching data", error);
            } finally {
                setInitialLoading(false);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        if (isNew) return;
        const fetchProduct = async () => {
            try {
                const res = await fetch(`/api/v1/products/id/${id}`);
                if (res.ok) {
                    const data = await res.json();
                    const specsObj = data.specs;
                    const filterSpecs: FilterSpec[] = specsObj && typeof specsObj === 'object' && !Array.isArray(specsObj)
                        ? Object.entries(specsObj).map(([k, v]) => ({ key: normalizeSpecKey(k), value: String(v) }))
                        : [];
                    setFormData({
                        title: data.title,
                        price: data.price,
                        sku: data.sku || "",
                        slug: data.slug,
                        stock: data.stock?.qty || 0,
                        description: data.description || "",
                        brandId: data.brandId?._id || data.brandId || "",
                        categoryIds: data.categoryIds?.map((c: any) => c._id || c) || [], // eslint-disable-line @typescript-eslint/no-explicit-any
                        attributes: (data.attributes || []).map((a: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
                            name: a.name,
                            value: a.value,
                            filterable: a.filterable ?? false
                        })),
                        filterSpecs,
                        isActive: data.isActive
                    });
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchProduct();
    }, [id, isNew]);

    // Fetch featured spec keys for the selected category (only these show in Filter Specs)
    useEffect(() => {
        const categoryId = formData.categoryIds[0];
        if (!categoryId) {
            setFeaturedSpecKeys([]);
            return;
        }
        const category = categories.find(c => c._id === categoryId);
        const slug = category?.slug ?? (category as { slug?: string })?.slug;
        if (!slug) {
            setFeaturedSpecKeys([]);
            return;
        }
        setFeaturedSpecsLoading(true);
        const token = JSON.parse(localStorage.getItem('userInfo') || '{}').token;
        fetch(`/api/v1/admin/categories/${encodeURIComponent(slug)}/featured-specs`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
            .then(res => res.ok ? res.json() : { featuredSpecKeys: [] })
            .then((data: { featuredSpecKeys?: string[] }) => setFeaturedSpecKeys(data.featuredSpecKeys || []))
            .catch(() => setFeaturedSpecKeys([]))
            .finally(() => setFeaturedSpecsLoading(false));
    }, [formData.categoryIds[0], categories]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const specsRecord: Record<string, string> = {};
            formData.filterSpecs.forEach(({ key, value }) => {
                const k = key.trim();
                if (k && featuredSpecKeys.includes(k)) specsRecord[k] = value.trim();
            });
            const { filterSpecs: _omit, ...rest } = formData;
            const payload = {
                ...rest,
                price: parseFloat(formData.price),
                stock: { qty: parseInt(formData.stock) },
                specs: Object.keys(specsRecord).length ? specsRecord : undefined,
            };

            const url = isNew
                ? `/api/v1/admin/products`
                : `/api/v1/admin/products/${id}`;

            const res = await fetch(url, {
                method: isNew ? 'POST' : 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${JSON.parse(localStorage.getItem('userInfo') || '{}').token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                router.push('/admin/products');
            } else {
                const error = await res.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error("Error saving product", error);
            alert("Failed to save product");
        } finally {
            setLoading(false);
        }
    };

    const updateAttribute = (index: number, field: keyof Attribute, val: string | boolean) => {
        const newAttrs = [...formData.attributes];
        (newAttrs[index] as any)[field] = val; // eslint-disable-line @typescript-eslint/no-explicit-any
        setFormData({ ...formData, attributes: newAttrs });
    };

    const addAttribute = () => {
        setFormData({
            ...formData,
            attributes: [...formData.attributes, { name: "", value: "" }]
        });
    };

    const removeAttribute = (index: number) => {
        setFormData({ ...formData, attributes: formData.attributes.filter((_, i) => i !== index) });
    };

    const moveAttributeUp = (index: number) => {
        if (index <= 0) return;
        const newAttrs = [...formData.attributes];
        [newAttrs[index - 1], newAttrs[index]] = [newAttrs[index], newAttrs[index - 1]];
        setFormData({ ...formData, attributes: newAttrs });
    };

    const moveAttributeDown = (index: number) => {
        if (index >= formData.attributes.length - 1) return;
        const newAttrs = [...formData.attributes];
        [newAttrs[index], newAttrs[index + 1]] = [newAttrs[index + 1], newAttrs[index]];
        setFormData({ ...formData, attributes: newAttrs });
    };

    const getFilterSpecValue = (specKey: string) =>
        formData.filterSpecs.find(s => s.key === specKey)?.value ?? "";

    const updateFilterSpecValue = (specKey: string, value: string) => {
        const next = formData.filterSpecs.filter(s => s.key !== specKey);
        if (value.trim()) next.push({ key: specKey, value: value.trim() });
        setFormData({ ...formData, filterSpecs: next });
    };

    const removeFilterSpecByKey = (specKey: string) => {
        setFormData({ ...formData, filterSpecs: formData.filterSpecs.filter(s => s.key !== specKey) });
    };

    const handleAddBrand = async () => {
        const name = window.prompt("Enter new brand name:");
        if (!name) return;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        try {
            const res = await fetch(`/api/v1/admin/products/brands`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${JSON.parse(localStorage.getItem('userInfo') || '{}').token}` },
                body: JSON.stringify({ name, slug })
            });
            if (res.ok) {
                const newBrand = await res.json();
                setBrands([...brands, newBrand]);
                setFormData({ ...formData, brandId: newBrand._id });
            } else {
                alert("Failed to create brand");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create brand");
        }
    };

    const handleEditBrand = async () => {
        if (!formData.brandId) return alert("Select a brand first");
        const brand = brands.find(b => b._id === formData.brandId);
        if (!brand) return;
        const newName = window.prompt("Edit brand name:", brand.name);
        if (!newName || newName === brand.name) return;
        const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        try {
            const res = await fetch(`/api/v1/admin/products/brands/${brand._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${JSON.parse(localStorage.getItem('userInfo') || '{}').token}` },
                body: JSON.stringify({ name: newName, slug })
            });
            if (res.ok) {
                const updated = await res.json();
                setBrands(brands.map(b => b._id === updated._id ? updated : b));
            } else {
                alert("Failed to update brand");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to update brand");
        }
    };

    const handleAddCategory = async () => {
        const name = window.prompt("Enter new category name:");
        if (!name) return;
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        try {
            const res = await fetch(`/api/v1/admin/products/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${JSON.parse(localStorage.getItem('userInfo') || '{}').token}` },
                body: JSON.stringify({ name, slug })
            });
            if (res.ok) {
                const newCategory = await res.json();
                setCategories([...categories, newCategory]);
                setFormData({ ...formData, categoryIds: [newCategory._id] });
            } else {
                alert("Failed to create category");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create category");
        }
    };

    const handleEditCategory = async () => {
        if (!formData.categoryIds[0]) return alert("Select a category first");
        const category = categories.find(c => c._id === formData.categoryIds[0]);
        if (!category) return;
        const newName = window.prompt("Edit category name:", category.name);
        if (!newName || newName === category.name) return;
        const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        try {
            const res = await fetch(`/api/v1/admin/products/categories/${category._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${JSON.parse(localStorage.getItem('userInfo') || '{}').token}` },
                body: JSON.stringify({ name: newName, slug })
            });
            if (res.ok) {
                const updated = await res.json();
                setCategories(categories.map(c => c._id === updated._id ? updated : c));
            } else {
                alert("Failed to update category");
            }
        } catch (e) {
            console.error(e);
            alert("Failed to update category");
        }
    };

    if (initialLoading && !isNew) return <div className="p-10 text-center text-main">Loading...</div>;

    return (
        <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="flex items-center gap-4 mb-8">
                <Link href="/admin/products" className="p-2 admin-card rounded-lg hover:bg-base text-main transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <h1 className="text-3xl font-bold text-main">{isNew ? 'New Product' : 'Edit Product'}</h1>
            </div>

            <form onSubmit={handleSubmit} className="admin-card rounded-xl p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sub text-sm">Product Title</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sub text-sm">SKU</label>
                        <input
                            type="text"
                            required
                            className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                            value={formData.sku}
                            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sub text-sm">Slug (Optional/Auto)</label>
                        <input
                            type="text"
                            className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                            value={formData.slug}
                            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sub text-sm">Price (LKR)</label>
                        <input
                            type="number"
                            required
                            className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sub text-sm">Stock Quantity</label>
                        <input
                            type="number"
                            required
                            className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                            value={formData.stock}
                            onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sub text-sm flex justify-between">
                            Brand
                            <div className="space-x-2">
                                <button type="button" onClick={handleEditBrand} title="Edit Brand" className="text-sub hover:text-main"><Edit2 className="w-4 h-4 inline" /></button>
                                <button type="button" onClick={handleAddBrand} title="Add Brand" className="text-blue-500 hover:text-blue-400"><Plus className="w-4 h-4 inline" /></button>
                            </div>
                        </label>
                        <select
                            className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-black"
                            value={formData.brandId}
                            onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                        >
                            <option value="">Select Brand</option>
                            {brands.map(b => (
                                <option key={b._id} value={b._id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sub text-sm flex justify-between">
                            Category
                            <div className="space-x-2">
                                <button type="button" onClick={handleEditCategory} title="Edit Category" className="text-sub hover:text-main"><Edit2 className="w-4 h-4 inline" /></button>
                                <button type="button" onClick={handleAddCategory} title="Add Category" className="text-blue-500 hover:text-blue-400"><Plus className="w-4 h-4 inline" /></button>
                            </div>
                        </label>
                        <select
                            className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-black"
                            value={formData.categoryIds[0] || ""}
                            onChange={(e) => setFormData({ ...formData, categoryIds: [e.target.value] })}
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sub text-sm">Description</label>
                    <textarea
                        className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent h-32"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    ></textarea>
                </div>

                {/* Filter Specs — only featured spec keys for the selected category */}
                <div className="border-t border-border-soft pt-6">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold text-main">Filter Specs</h2>
                        <p className="text-sub text-sm mt-0.5">Only the category’s featured specs are shown. Set values to appear in shop filters.</p>
                    </div>

                    {featuredSpecsLoading && (
                        <p className="text-sub text-sm italic">Loading featured specs for category…</p>
                    )}
                    {!featuredSpecsLoading && !formData.categoryIds[0] && (
                        <p className="text-sub text-sm italic">Select a category to see filter specs.</p>
                    )}
                    {!featuredSpecsLoading && formData.categoryIds[0] && featuredSpecKeys.length === 0 && (
                        <p className="text-sub text-sm italic">No featured specs for this category. Configure them under Admin → Categories → Featured Specs.</p>
                    )}
                    {!featuredSpecsLoading && featuredSpecKeys.length > 0 && (
                        <>
                            <div className="flex gap-4 mb-2 px-1">
                                <span className="flex-1 text-xs text-sub uppercase tracking-wider">Key</span>
                                <span className="flex-1 text-xs text-sub uppercase tracking-wider">Value</span>
                                <span className="w-8" />
                            </div>
                            <div className="space-y-3">
                                {featuredSpecKeys.map((specKey) => (
                                    <div key={specKey} className="flex gap-4 items-center">
                                        <input
                                            type="text"
                                            readOnly
                                            className="flex-1 bg-base border border-border-soft rounded-lg px-4 py-2 text-sub cursor-default"
                                            value={specKey}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Value"
                                            className="flex-1 bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                                            value={getFilterSpecValue(specKey)}
                                            onChange={(e) => updateFilterSpecValue(specKey, e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeFilterSpecByKey(specKey)}
                                            className="p-2 text-red-400 hover:bg-red-400/10 rounded"
                                            title="Clear value"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Properties / Attributes */}
                <div className="border-t border-border-soft pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-main">Properties / Attributes</h2>
                        </div>
                        <button
                            type="button"
                            onClick={addAttribute}
                            className="text-sm bg-accent/20 text-accent px-3 py-1 rounded hover:bg-accent/30 transition-colors"
                        >
                            + Add Property
                        </button>
                    </div>

                    {formData.attributes.length > 0 && (
                        <div className="flex gap-2 mb-2 px-1">
                            <span className="w-16 text-xs text-sub uppercase tracking-wider shrink-0">Order</span>
                            <span className="flex-1 text-xs text-sub uppercase tracking-wider">Name</span>
                            <span className="flex-1 text-xs text-sub uppercase tracking-wider">Value</span>
                            <span className="w-8 shrink-0" />
                        </div>
                    )}

                    <div className="space-y-3">
                        {formData.attributes.map((attr, index) => (
                            <div key={index} className="flex gap-2 items-center">
                                <div className="flex flex-col w-16 shrink-0 gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => moveAttributeUp(index)}
                                        disabled={index === 0}
                                        className="p-1.5 text-sub hover:text-main hover:bg-white/5 rounded disabled:opacity-40 disabled:pointer-events-none"
                                        title="Move up"
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveAttributeDown(index)}
                                        disabled={index === formData.attributes.length - 1}
                                        className="p-1.5 text-sub hover:text-main hover:bg-white/5 rounded disabled:opacity-40 disabled:pointer-events-none"
                                        title="Move down"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Name (e.g. Color)"
                                    className="flex-1 bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent min-w-0"
                                    value={attr.name}
                                    onChange={(e) => updateAttribute(index, 'name', e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Value (e.g. Red)"
                                    className="flex-1 bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent min-w-0"
                                    value={attr.value}
                                    onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeAttribute(index)}
                                    className="p-2 text-red-400 hover:bg-red-400/10 rounded shrink-0"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        ))}
                        {formData.attributes.length === 0 && (
                            <p className="text-sub text-sm italic">No properties added.</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border-soft">
                    <input
                        type="checkbox"
                        id="isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="text-main">Active Product</label>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-accent hover:bg-accent/90 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        <Save className="h-5 w-5" />
                        {loading ? 'Saving...' : 'Save Product'}
                    </button>
                </div>
            </form>
        </div>
    );
}
