"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft, Trash2, Edit2, Plus, ChevronUp, ChevronDown, ImagePlus, Upload, Loader2, ArrowRightLeft } from "lucide-react";
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

interface AttributeGroup {
    category: string;
    attributes: Attribute[];
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
        attributeGroups: [] as AttributeGroup[],
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
    // Selected attributes for "move to category": Set of "groupIndex-attrIndex"
    const [selectedAttributeKeys, setSelectedAttributeKeys] = useState<Set<string>>(new Set());

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
                const rawGroups = data.attributeGroups;
                const attributeGroups: AttributeGroup[] =
                    rawGroups && Array.isArray(rawGroups) && rawGroups.length > 0
                        ? rawGroups.map((g: any) => ({
                            category: g.category || 'General',
                            attributes: (g.attributes || []).map((a: any) => ({ name: a.name || '', value: a.value || '' }))
                        }))
                        : (data.attributes && Array.isArray(data.attributes) && data.attributes.length > 0)
                            ? [{ category: 'General', attributes: data.attributes.map((a: any) => ({ name: a.name || '', value: a.value || '' })) }]
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
                    attributeGroups,
                    filterSpecs,
                    images: Array.isArray(data.images) ? data.images : [],
                    isActive: data.isActive
                });
                setSelectedAttributeKeys(new Set());
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
                attributeGroups: formData.attributeGroups.filter(
                    g => g.category.trim() && g.attributes.some(a => a.name.trim() || a.value.trim())
                ).map(g => ({
                    category: g.category.trim(),
                    attributes: g.attributes.filter(a => a.name.trim() || a.value.trim()).map(a => ({ name: a.name.trim(), value: a.value.trim() }))
                })),
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

    const updateAttribute = (groupIndex: number, attrIndex: number, field: keyof Attribute, val: string) => {
        const newGroups = formData.attributeGroups.map((g, i) => {
            if (i !== groupIndex) return g;
            const newAttrs = g.attributes.map((a, j) => (j === attrIndex ? { ...a, [field]: val } : a));
            return { ...g, attributes: newAttrs };
        });
        setFormData({ ...formData, attributeGroups: newGroups });
    };

    const addAttributeGroup = () => {
        setFormData({
            ...formData,
            attributeGroups: [...formData.attributeGroups, { category: "General", attributes: [] }]
        });
    };

    const removeAttributeGroup = (groupIndex: number) => {
        setFormData({
            ...formData,
            attributeGroups: formData.attributeGroups.filter((_, i) => i !== groupIndex)
        });
    };

    const updateGroupCategory = (groupIndex: number, category: string) => {
        const newGroups = formData.attributeGroups.map((g, i) => (i === groupIndex ? { ...g, category } : g));
        setFormData({ ...formData, attributeGroups: newGroups });
    };

    const addAttributeToGroup = (groupIndex: number) => {
        const newGroups = formData.attributeGroups.map((g, i) =>
            i === groupIndex ? { ...g, attributes: [...g.attributes, { name: "", value: "" }] } : g
        );
        setFormData({ ...formData, attributeGroups: newGroups });
    };

    const removeAttribute = (groupIndex: number, attrIndex: number) => {
        const newGroups = formData.attributeGroups.map((g, i) => {
            if (i !== groupIndex) return g;
            return { ...g, attributes: g.attributes.filter((_, j) => j !== attrIndex) };
        });
        setFormData({ ...formData, attributeGroups: newGroups });
    };

    const moveAttributeUp = (groupIndex: number, attrIndex: number) => {
        if (attrIndex <= 0) return;
        const newGroups = formData.attributeGroups.map((g, i) => {
            if (i !== groupIndex) return g;
            const arr = [...g.attributes];
            [arr[attrIndex - 1], arr[attrIndex]] = [arr[attrIndex], arr[attrIndex - 1]];
            return { ...g, attributes: arr };
        });
        setFormData({ ...formData, attributeGroups: newGroups });
    };

    const moveAttributeDown = (groupIndex: number, attrIndex: number) => {
        const g = formData.attributeGroups[groupIndex];
        if (!g || attrIndex >= g.attributes.length - 1) return;
        const newGroups = formData.attributeGroups.map((gr, i) => {
            if (i !== groupIndex) return gr;
            const arr = [...gr.attributes];
            [arr[attrIndex], arr[attrIndex + 1]] = [arr[attrIndex + 1], arr[attrIndex]];
            return { ...gr, attributes: arr };
        });
        setFormData({ ...formData, attributeGroups: newGroups });
    };

    const moveGroupUp = (groupIndex: number) => {
        if (groupIndex <= 0) return;
        const arr = [...formData.attributeGroups];
        [arr[groupIndex - 1], arr[groupIndex]] = [arr[groupIndex], arr[groupIndex - 1]];
        setFormData({ ...formData, attributeGroups: arr });
    };

    const moveGroupDown = (groupIndex: number) => {
        if (groupIndex >= formData.attributeGroups.length - 1) return;
        const arr = [...formData.attributeGroups];
        [arr[groupIndex], arr[groupIndex + 1]] = [arr[groupIndex + 1], arr[groupIndex]];
        setFormData({ ...formData, attributeGroups: arr });
    };

    const attrKey = (groupIndex: number, attrIndex: number) => `${groupIndex}-${attrIndex}`;
    const isAttributeSelected = (groupIndex: number, attrIndex: number) => selectedAttributeKeys.has(attrKey(groupIndex, attrIndex));
    const toggleAttributeSelection = (groupIndex: number, attrIndex: number) => {
        const key = attrKey(groupIndex, attrIndex);
        setSelectedAttributeKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    const selectAllInGroup = (groupIndex: number) => {
        const g = formData.attributeGroups[groupIndex];
        if (!g) return;
        setSelectedAttributeKeys((prev) => {
            const next = new Set(prev);
            g.attributes.forEach((_, attrIndex) => next.add(attrKey(groupIndex, attrIndex)));
            return next;
        });
    };
    const deselectAllInGroup = (groupIndex: number) => {
        const g = formData.attributeGroups[groupIndex];
        if (!g) return;
        setSelectedAttributeKeys((prev) => {
            const next = new Set(prev);
            g.attributes.forEach((_, attrIndex) => next.delete(attrKey(groupIndex, attrIndex)));
            return next;
        });
    };
    const clearAttributeSelection = () => setSelectedAttributeKeys(new Set());

    const moveSelectedAttributesToGroup = (targetGroupIndex: number) => {
        const keys = Array.from(selectedAttributeKeys);
        if (keys.length === 0) return;
        const toMove: { groupIndex: number; attrIndex: number }[] = keys.map((k) => {
            const [g, a] = k.split("-").map(Number);
            return { groupIndex: g, attrIndex: a };
        });
        const groups = formData.attributeGroups.map((g) => ({ ...g, attributes: [...g.attributes] }));
        const targetGroup = groups[targetGroupIndex];
        if (!targetGroup) return;
        const toAdd: Attribute[] = [];
        toMove
            .sort((a, b) => (a.groupIndex !== b.groupIndex ? a.groupIndex - b.groupIndex : a.attrIndex - b.attrIndex))
            .reverse()
            .forEach(({ groupIndex, attrIndex }) => {
                const gr = groups[groupIndex];
                if (!gr || attrIndex < 0 || attrIndex >= gr.attributes.length) return;
                toAdd.unshift(gr.attributes[attrIndex]);
                gr.attributes.splice(attrIndex, 1);
            });
        targetGroup.attributes.push(...toAdd);
        setFormData({ ...formData, attributeGroups: groups });
        setSelectedAttributeKeys(new Set());
    };

    const uploadImage = async (file: File): Promise<{ url: string }> => {
        const formDataUpload = new FormData();
        formDataUpload.append("image", file);
        const baseURL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
        const url = `${baseURL}/admin/upload/image`;
        try {
            const token = typeof window !== "undefined" && (() => {
                try {
                    const raw = localStorage.getItem("userInfo");
                    const data = raw ? JSON.parse(raw) : {};
                    return data?.token;
                } catch { return undefined; }
            })();
            const res = await fetch(url, {
                method: "POST",
                body: formDataUpload,
                credentials: "include",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                // Do NOT set Content-Type: fetch will set multipart/form-data with boundary automatically
            });
            const data = await res.json().catch(() => ({}));
            if (res.status === 401) {
                throw new Error("Please log in to upload images. Go to Login and sign in as admin.");
            }
            if (!res.ok) throw new Error((data?.message as string) || "Upload failed");
            return data;
        } catch (err: unknown) {
            if (err instanceof Error) throw err;
            throw new Error("Upload failed");
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

                {/* Product details — attribute groups (e.g. General, Cable Specs) */}
                <div className="border-t border-border-soft pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-main">Product details (Attributes)</h2>
                            <p className="text-sub text-sm mt-0.5">Group attributes by category (e.g. General, Cable Specs, General Specs).</p>
                        </div>
                        <button
                            type="button"
                            onClick={addAttributeGroup}
                            className="text-sm bg-accent/20 text-accent px-3 py-1.5 rounded hover:bg-accent/30 transition-colors flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" /> Add category
                        </button>
                    </div>

                    {formData.attributeGroups.length === 0 && (
                        <p className="text-sub text-sm italic">No attribute categories. Click &quot;Add category&quot; to add one (e.g. General, Cable Specs).</p>
                    )}

                    {selectedAttributeKeys.size > 0 && formData.attributeGroups.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/30 mb-4">
                            <span className="text-sm font-medium text-main">
                                {selectedAttributeKeys.size} attribute{selectedAttributeKeys.size !== 1 ? "s" : ""} selected
                            </span>
                            <select
                                id="move-target-category"
                                className="bg-base border border-border-soft rounded-lg px-3 py-1.5 text-sm text-main focus:outline-none focus:border-accent [&>option]:text-black"
                            >
                                <option value="">Move to category…</option>
                                {formData.attributeGroups.map((g, i) => (
                                    <option key={i} value={i}>
                                        {g.category || `Category ${i + 1}`}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => {
                                    const sel = document.getElementById("move-target-category") as HTMLSelectElement | null;
                                    const val = sel?.value;
                                    if (val === "" || val == null) return;
                                    moveSelectedAttributesToGroup(Number(val));
                                }}
                                className="text-sm bg-accent text-white px-3 py-1.5 rounded hover:bg-accent/90 flex items-center gap-1.5"
                            >
                                <ArrowRightLeft className="h-4 w-4" /> Move
                            </button>
                            <button
                                type="button"
                                onClick={clearAttributeSelection}
                                className="text-sm text-sub hover:text-main"
                            >
                                Clear selection
                            </button>
                        </div>
                    )}

                    <div className="space-y-6">
                        {formData.attributeGroups.map((group, groupIndex) => (
                            <div key={groupIndex} className="bg-base rounded-xl border border-border-soft p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="flex flex-col w-12 shrink-0 gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => moveGroupUp(groupIndex)}
                                            disabled={groupIndex === 0}
                                            className="p-1 text-sub hover:text-main hover:bg-white/5 rounded disabled:opacity-40 disabled:pointer-events-none"
                                            title="Move category up"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveGroupDown(groupIndex)}
                                            disabled={groupIndex === formData.attributeGroups.length - 1}
                                            className="p-1 text-sub hover:text-main hover:bg-white/5 rounded disabled:opacity-40 disabled:pointer-events-none"
                                            title="Move category down"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Category name (e.g. General, Cable Specs)"
                                        className="flex-1 bg-white/5 border border-border-soft rounded-lg px-3 py-2 text-main font-medium focus:outline-none focus:border-accent"
                                        value={group.category}
                                        onChange={(e) => updateGroupCategory(groupIndex, e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeAttributeGroup(groupIndex)}
                                        className="p-2 text-red-400 hover:bg-red-400/10 rounded shrink-0"
                                        title="Remove category"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                                {group.attributes.length > 0 && (
                                    <div className="flex items-center gap-2 mb-2 pl-4">
                                        <button
                                            type="button"
                                            onClick={() => selectAllInGroup(groupIndex)}
                                            className="text-xs text-accent hover:underline"
                                        >
                                            Select all
                                        </button>
                                        <span className="text-sub">|</span>
                                        <button
                                            type="button"
                                            onClick={() => deselectAllInGroup(groupIndex)}
                                            className="text-xs text-sub hover:underline"
                                        >
                                            Deselect all
                                        </button>
                                    </div>
                                )}

                                <div className="pl-4 space-y-2">
                                    {group.attributes.length > 0 && (
                                        <div className="flex gap-2 mb-2 px-1 text-xs text-sub uppercase tracking-wider">
                                            <span className="w-8 shrink-0">Select</span>
                                            <span className="w-16 shrink-0">Order</span>
                                            <span className="flex-1">Name</span>
                                            <span className="flex-1">Value</span>
                                            <span className="w-8 shrink-0" />
                                        </div>
                                    )}
                                    {group.attributes.map((attr, attrIndex) => (
                                        <div key={attrIndex} className={`flex gap-2 items-center rounded px-2 py-1 ${isAttributeSelected(groupIndex, attrIndex) ? "bg-accent/15" : ""}`}>
                                            <label className="w-8 shrink-0 flex items-center cursor-pointer" title="Select to move to another category">
                                                <input
                                                    type="checkbox"
                                                    checked={isAttributeSelected(groupIndex, attrIndex)}
                                                    onChange={() => toggleAttributeSelection(groupIndex, attrIndex)}
                                                    className="w-4 h-4 rounded border-gray-500 text-accent focus:ring-accent"
                                                />
                                            </label>
                                            <div className="flex flex-col w-16 shrink-0 gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => moveAttributeUp(groupIndex, attrIndex)}
                                                    disabled={attrIndex === 0}
                                                    className="p-1.5 text-sub hover:text-main hover:bg-white/5 rounded disabled:opacity-40 disabled:pointer-events-none"
                                                    title="Move up"
                                                >
                                                    <ChevronUp className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveAttributeDown(groupIndex, attrIndex)}
                                                    disabled={attrIndex === group.attributes.length - 1}
                                                    className="p-1.5 text-sub hover:text-main hover:bg-white/5 rounded disabled:opacity-40 disabled:pointer-events-none"
                                                    title="Move down"
                                                >
                                                    <ChevronDown className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Name (e.g. Color)"
                                                className="flex-1 bg-base border border-border-soft rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-accent min-w-0"
                                                value={attr.name}
                                                onChange={(e) => updateAttribute(groupIndex, attrIndex, "name", e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value (e.g. Red)"
                                                className="flex-1 bg-base border border-border-soft rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-accent min-w-0"
                                                value={attr.value}
                                                onChange={(e) => updateAttribute(groupIndex, attrIndex, "value", e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeAttribute(groupIndex, attrIndex)}
                                                className="p-2 text-red-400 hover:bg-red-400/10 rounded shrink-0"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => addAttributeToGroup(groupIndex)}
                                        className="text-sm text-accent hover:bg-accent/10 px-3 py-1.5 rounded transition-colors"
                                    >
                                        + Add property to this category
                                    </button>
                                </div>
                            </div>
                        ))}
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
