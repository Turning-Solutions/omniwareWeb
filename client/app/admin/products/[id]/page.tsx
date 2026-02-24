"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Trash2, Edit2, Plus, ChevronUp, ChevronDown, ImagePlus, Upload, Loader2 } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";

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
        images: [] as string[],
        isActive: true
    });

    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [featuredSpecKeys, setFeaturedSpecKeys] = useState<string[]>([]);
    const [featuredSpecsLoading, setFeaturedSpecsLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [imageUploading, setImageUploading] = useState<string | number | null>(null); // 'add' or index when replacing

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [brandsRes, categoriesRes] = await Promise.all([
                    api.get("/products/brands"),
                    api.get("/products/categories")
                ]);
                setBrands(brandsRes.data);
                setCategories(categoriesRes.data);
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
                const { data } = await api.get(`/products/id/${id}`);
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
                    images: Array.isArray(data.images) ? data.images : [],
                    isActive: data.isActive
                });
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
        api.get(`/admin/categories/${encodeURIComponent(slug)}/featured-specs`)
            .then(({ data }: { data: { featuredSpecKeys?: string[] } }) => setFeaturedSpecKeys(data.featuredSpecKeys || []))
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

            if (isNew) {
                await api.post("/admin/products", payload);
            } else {
                await api.patch(`/admin/products/${id}`, payload);
            }
            router.push('/admin/products');
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

    const uploadImage = async (file: File): Promise<{ url: string }> => {
        const formDataUpload = new FormData();
        formDataUpload.append("image", file);
        try {
            const { data } = await api.post("/admin/upload/image", formDataUpload);
            return data;
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                throw new Error("Please log in to upload images. Go to Login and sign in as admin.");
            }
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            throw new Error(msg || "Upload failed");
        }
    };

    const deleteImageFromCloud = async (url: string): Promise<void> => {
        try {
            await api.post("/admin/upload/delete-image", { url });
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 401) {
                throw new Error("Please log in to delete images.");
            }
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            throw new Error(msg || "Delete failed");
        }
    };

    const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setImageUploading("add");
        try {
            const { url } = await uploadImage(file);
            setFormData((prev) => ({ ...prev, images: [...prev.images, url] }));
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setImageUploading(null);
        }
    };

    const handleRemoveImage = async (index: number) => {
        const url = formData.images[index];
        if (!url) return;
        const isCloudinary = url.includes("cloudinary.com");
        if (isCloudinary) {
            try {
                await deleteImageFromCloud(url);
            } catch (err) {
                alert((err as Error).message);
                return;
            }
        }
        setFormData((prev) => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index),
        }));
    };

    const handleReplaceImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        const oldUrl = formData.images[index];
        const isCloudinary = oldUrl?.includes("cloudinary.com");
        setImageUploading(index);
        try {
            if (isCloudinary && oldUrl) await deleteImageFromCloud(oldUrl);
            const { url } = await uploadImage(file);
            setFormData((prev) => ({
                ...prev,
                images: prev.images.map((u, i) => (i === index ? url : u)),
            }));
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setImageUploading(null);
        }
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
            const { data: newBrand } = await api.post("/admin/products/brands", { name, slug });
            setBrands([...brands, newBrand]);
            setFormData({ ...formData, brandId: newBrand._id });
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
            const { data: updated } = await api.put(`/admin/products/brands/${brand._id}`, { name: newName, slug });
            setBrands(brands.map(b => b._id === updated._id ? updated : b));
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
            const { data: newCategory } = await api.post("/admin/products/categories", { name, slug });
            setCategories([...categories, newCategory]);
            setFormData({ ...formData, categoryIds: [newCategory._id] });
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
            const { data: updated } = await api.put(`/admin/products/categories/${category._id}`, { name: newName, slug });
            setCategories(categories.map(c => c._id === updated._id ? updated : c));
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
                        <label className="text-sub text-sm">SKU (Optional)</label>
                        <input
                            type="text"
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

                {/* Product images (Cloudinary) */}
                <div className="border-t border-border-soft pt-6">
                    <h2 className="text-xl font-bold text-main mb-2">Product images</h2>
                    <p className="text-sub text-sm mb-4">Upload images to Cloudinary. You can delete or replace any image.</p>
                    <div className="flex flex-wrap gap-4">
                        {formData.images.map((url, index) => (
                            <div key={index} className="relative group">
                                <div className="w-28 h-28 rounded-lg border border-border-soft bg-base overflow-hidden flex items-center justify-center">
                                    {imageUploading === index ? (
                                        <Loader2 className="w-8 h-8 text-accent animate-spin" />
                                    ) : (
                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="absolute inset-0 rounded-lg bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 transition-opacity">
                                    <label className="cursor-pointer p-1.5 rounded bg-white/20 hover:bg-white/30 text-white" title="Replace">
                                        <Upload className="w-4 h-4" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleReplaceImage(index, e)}
                                            disabled={imageUploading !== null}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveImage(index)}
                                        className="p-1.5 rounded bg-red-500/80 hover:bg-red-500 text-white"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <label className="w-28 h-28 rounded-lg border-2 border-dashed border-border-soft bg-base flex items-center justify-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors">
                            {imageUploading === "add" ? (
                                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                            ) : (
                                <ImagePlus className="w-8 h-8 text-sub" />
                            )}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleAddImage}
                                disabled={imageUploading !== null}
                            />
                        </label>
                    </div>
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
