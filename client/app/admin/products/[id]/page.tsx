"use client";

import { useState, useEffect, use, useMemo } from "react";
import { isAxiosError } from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Save, ArrowLeft, Trash2, Edit2, Plus, ChevronUp, ChevronDown, ImagePlus, Upload, Loader2, ArrowRightLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Brand {
    _id: string;
    name: string;
}

interface Category {
    _id: string;
    name: string;
    slug?: string;
    discountPercent?: number | null;
    parentId?: string | null;
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

interface ColorVariant {
    name: string;
    hex: string;
    price: string;
    image?: string;
}

const DEFAULT_ATTRIBUTE_GROUP_NAME = "Specifications";
const WARRANTY_OPTIONS = [
    "6 Months",
    "1 Year",
    "2 Years",
    "3 Years",
    "4 Years",
    "5 Years",
    "6 Years",
    "7 Years",
    "8 Years",
    "9 Years",
    "10 Years",
] as const;

const COLOR_NAME_TO_HEX: Record<string, string> = {
    black: "#000000",
    white: "#FFFFFF",
    red: "#FF0000",
    blue: "#0000FF",
    green: "#008000",
    yellow: "#FFFF00",
    orange: "#FFA500",
    purple: "#800080",
    pink: "#FFC0CB",
    gray: "#808080",
    grey: "#808080",
    silver: "#C0C0C0",
    gold: "#FFD700",
    brown: "#8B4513",
    navy: "#000080",
    maroon: "#800000",
    cyan: "#00FFFF",
    teal: "#008080",
    olive: "#808000",
    beige: "#F5F5DC",
};

const sortByName = <T extends { name: string }>(items: T[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

function getApiErrorMessage(error: unknown) {
    if (!isAxiosError(error)) return "Failed to save product";
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
    if (Array.isArray(message)) {
        const firstIssue = message[0];
        if (typeof firstIssue === "string" && firstIssue.trim()) return firstIssue;
        if (firstIssue && typeof firstIssue === "object" && "message" in firstIssue) {
            const issueMessage = firstIssue.message;
            if (typeof issueMessage === "string" && issueMessage.trim()) return issueMessage;
        }
    }
    return error.message || "Failed to save product";
}

function suggestHexFromColorName(name: string): string {
    const key = name.trim().toLowerCase();
    return COLOR_NAME_TO_HEX[key] || "";
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

function formatSpecLabel(specKey: string): string {
    return specKey.replace(/_/g, " ");
}

/** Keep admin-entered category slugs consistent for names like "M.2 NVMe". */
function normalizeCategorySlugInput(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/\bm[\s._-]*2\b/g, "m2")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

export default function ProductFormPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const isNew = id === 'new';
    const rawReturnTo = searchParams?.get("returnTo");
    const decodedReturnTo = rawReturnTo ? decodeURIComponent(rawReturnTo) : "";
    const returnToPath =
        decodedReturnTo.startsWith("/admin/products") ? decodedReturnTo : "/admin/products";

    const [formData, setFormData] = useState({
        title: "",
        price: "",
        dealerPrice: "",
        /** Optional product-level discount override amount (empty => use category discount). */
        discountPercent: "",
        sku: "",
        slug: "",
        stock: "",
        description: "",
        warranty: "",
        brandId: "",
        categoryIds: [] as string[],
        /** Category-wide discount amount for the currently selected category (empty => no category discount). */
        categoryDiscountPercent: "",
        attributeGroups: [] as AttributeGroup[],
        filterSpecs: [] as FilterSpec[],
        colorVariants: [] as ColorVariant[],
        images: [] as string[],
        availability: "pre_order" as "in_stock" | "out_of_stock" | "pre_order" | "coming_soon",
        isActive: true
    });

    const [brands, setBrands] = useState<Brand[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [mainCategoryId, setMainCategoryId] = useState("");
    const [subCategoryId, setSubCategoryId] = useState("");
    const [featuredSpecKeys, setFeaturedSpecKeys] = useState<string[]>([]);
    const [featuredSpecsLoading, setFeaturedSpecsLoading] = useState(false);
    const [specSuggestions, setSpecSuggestions] = useState<Record<string, string[]>>({});
    const [activeSpecKey, setActiveSpecKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [imageUploading, setImageUploading] = useState<string | number | null>(null); // 'add' or index when replacing
    const [colorImageUploading, setColorImageUploading] = useState<number | null>(null);
    const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
    const [initialCategoryDiscountPercent, setInitialCategoryDiscountPercent] = useState<string>("");
    // Selected attributes for "move to category": Set of "groupIndex-attrIndex"
    const [selectedAttributeKeys, setSelectedAttributeKeys] = useState<Set<string>>(new Set());
    const previewTarget = !isNew ? (formData.slug?.trim() || id) : "";
    const previewPath = previewTarget ? `/product/${previewTarget}?preview=${previewRefreshKey}` : "";
    const mainCategories = sortByName(categories.filter((category) => !category.parentId));
    const subCategories = sortByName(categories.filter((category) => category.parentId === mainCategoryId));
    const effectiveCategoryId = subCategoryId || mainCategoryId;
    const sortedBrands = sortByName(brands);
    const sortedAttributeGroupTargets = useMemo(
        () =>
            formData.attributeGroups
                .map((group, index) => ({ index, label: group.category || `Category ${index + 1}` }))
                .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" })),
        [formData.attributeGroups]
    );

    const notifyProductsListUpdated = (productId: string) => {
        if (typeof window === "undefined") return;
        const payload = { productId, at: Date.now() };
        try {
            window.localStorage.setItem("admin-products-updated", JSON.stringify(payload));
        } catch {
            // Ignore storage failures; same-tab custom event still updates listeners.
        }
        window.dispatchEvent(new CustomEvent("admin-products-updated", { detail: payload }));
    };

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
                const { data } = await api.get(`/admin/products/${id}`);
                const specsObj = data.specs;
                // Mongoose `Map` fields sometimes arrive as Map-like objects; normalize to plain entries.
                const specsEntries: Array<[string, unknown]> =
                    specsObj && typeof specsObj === "object"
                        ? specsObj instanceof Map
                            ? Array.from(specsObj.entries())
                            : Array.isArray(specsObj)
                              ? []
                              : Object.entries(specsObj as Record<string, unknown>)
                        : [];

                const filterSpecs: FilterSpec[] = specsEntries
                    .map(([k, v]) => ({ key: normalizeSpecKey(k), value: String(v) }));
                const rawGroups = data.attributeGroups;
                const colorVariants: ColorVariant[] = Array.isArray(data.colorVariants)
                    ? data.colorVariants.map((v: { name?: string; hex?: string; image?: string; price?: number }) => ({
                        name: v.name || "",
                        hex: v.hex || "",
                        image: v.image || "",
                        price: v.price != null ? String(v.price) : "",
                    }))
                    : [];
                const attributeGroups: AttributeGroup[] =
                    rawGroups && Array.isArray(rawGroups) && rawGroups.length > 0
                        ? rawGroups.map((g: any) => ({
                            category: g.category || 'General',
                            attributes: (g.attributes || []).map((a: any) => ({ name: a.name || '', value: a.value || '' }))
                        }))
                        : (data.attributes && Array.isArray(data.attributes) && data.attributes.length > 0)
                            ? [{ category: 'General', attributes: data.attributes.map((a: any) => ({ name: a.name || '', value: a.value || '' })) }]
                            : [];

                const productDiscountPercent = data.discountPercent != null ? String(data.discountPercent) : "";
                const rawCategoryIds: string[] =
                    data.categoryIds
                        ?.map((c: unknown) => {
                            if (typeof c === "string") return c;
                            if (c && typeof c === "object" && "_id" in c) {
                                const maybeId = (c as { _id?: unknown })._id;
                                return typeof maybeId === "string" ? maybeId : undefined;
                            }
                            return undefined;
                        })
                        .filter((catId: string | undefined): catId is string => Boolean(catId)) ?? [];
                const categoryIdsSet = new Set(rawCategoryIds);
                const availableCategoryById = new Map(categories.map((category) => [category._id, category] as const));
                let nextMainCategoryId = "";
                let nextSubCategoryId = "";
                for (const catId of rawCategoryIds) {
                    const category = availableCategoryById.get(catId);
                    if (!category) continue;
                    if (!category.parentId) {
                        if (!nextMainCategoryId) nextMainCategoryId = category._id;
                        continue;
                    }
                    const parentCategory = availableCategoryById.get(category.parentId);
                    if (parentCategory && !nextMainCategoryId) nextMainCategoryId = parentCategory._id;
                    if (!nextSubCategoryId) nextSubCategoryId = category._id;
                }
                if (!nextMainCategoryId) {
                    const fallbackSubCategory = rawCategoryIds
                        .map((catId) => availableCategoryById.get(catId))
                        .find((category): category is Category => Boolean(category?.parentId));
                    if (fallbackSubCategory?.parentId) {
                        nextMainCategoryId = fallbackSubCategory.parentId;
                        nextSubCategoryId = fallbackSubCategory._id;
                    }
                }
                if (!nextMainCategoryId) {
                    const fallbackMainCategory = rawCategoryIds
                        .map((catId) => availableCategoryById.get(catId))
                        .find((category): category is Category => Boolean(category && !category.parentId));
                    if (fallbackMainCategory) {
                        nextMainCategoryId = fallbackMainCategory._id;
                    }
                }
                if (nextSubCategoryId && nextMainCategoryId) {
                    const selectedSub = availableCategoryById.get(nextSubCategoryId);
                    if (selectedSub?.parentId !== nextMainCategoryId) {
                        nextSubCategoryId = "";
                    }
                }
                // Keep any legacy extra category IDs after main+sub so existing data is not silently dropped.
                const nextCategoryIds = [
                    ...(nextMainCategoryId ? [nextMainCategoryId] : []),
                    ...(nextSubCategoryId ? [nextSubCategoryId] : []),
                    ...rawCategoryIds.filter(
                        (catId) => catId !== nextMainCategoryId && catId !== nextSubCategoryId && categoryIdsSet.has(catId)
                    ),
                ];
                const selectedCategoryForDiscount =
                    availableCategoryById.get(nextSubCategoryId) ||
                    availableCategoryById.get(nextMainCategoryId) ||
                    null;
                const categoryDiscountPercent =
                    selectedCategoryForDiscount?.discountPercent != null
                        ? String(selectedCategoryForDiscount.discountPercent)
                        : "";
                setInitialCategoryDiscountPercent(categoryDiscountPercent);
                setMainCategoryId(nextMainCategoryId);
                setSubCategoryId(nextSubCategoryId);

                setFormData({
                    title: data.title ?? "",
                    price: data.price != null ? String(data.price) : "",
                    dealerPrice: data.dealerPrice != null ? String(data.dealerPrice) : "",
                    discountPercent: productDiscountPercent,
                    sku: data.sku ?? "",
                    slug: data.slug ?? "",
                    stock: data.stock?.qty != null ? String(data.stock.qty) : "",
                    description: data.description ?? "",
                    warranty: data.warranty ?? "",
                    brandId: data.brandId?._id || data.brandId || "",
                    categoryIds: nextCategoryIds,
                    categoryDiscountPercent,
                    attributeGroups,
                    filterSpecs,
                    colorVariants,
                    images: Array.isArray(data.images) ? data.images : [],
                    availability: data.availability || "pre_order",
                    isActive: typeof data.isActive === "boolean" ? data.isActive : true,
                });
                setSelectedAttributeKeys(new Set());
            } catch (err) {
                console.error(err);
            }
        };
        fetchProduct();
    }, [id, isNew, categories]);

    // Fetch featured spec keys for the selected category (only these show in Filter Specs)
    useEffect(() => {
        const categoryId = effectiveCategoryId;
        if (!categoryId) {
            setFeaturedSpecKeys([]);
            setSpecSuggestions({});
            return;
        }
        const category = categories.find(c => c._id === categoryId);
        const slug = category?.slug ?? (category as { slug?: string })?.slug;
        if (!slug) {
            setFeaturedSpecKeys([]);
            setSpecSuggestions({});
            return;
        }
        setFeaturedSpecsLoading(true);
        api.get(`/admin/categories/${encodeURIComponent(slug)}/featured-specs`)
            .then(({ data }: { data: { featuredSpecKeys?: string[]; specValues?: Record<string, string[]> } }) => {
                setFeaturedSpecKeys(data.featuredSpecKeys || []);
                setSpecSuggestions(data.specValues || {});
            })
            .catch(() => { setFeaturedSpecKeys([]); setSpecSuggestions({}); })
            .finally(() => setFeaturedSpecsLoading(false));
    }, [effectiveCategoryId, categories]);

    useEffect(() => {
        const normalizedCategoryIds = [
            ...(mainCategoryId ? [mainCategoryId] : []),
            ...(subCategoryId ? [subCategoryId] : []),
        ];
        setFormData((prev) => {
            const currentMain = prev.categoryIds[0] || "";
            const currentSub = prev.categoryIds[1] || "";
            if (currentMain === mainCategoryId && currentSub === subCategoryId && prev.categoryIds.length <= 2) {
                return prev;
            }
            return { ...prev, categoryIds: normalizedCategoryIds };
        });
    }, [mainCategoryId, subCategoryId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const parsedPrice = parseFloat(formData.price);
            const parsedDealerPrice =
                formData.dealerPrice.trim() === "" ? null : parseFloat(formData.dealerPrice);
            const parsedStockQty = parseInt(formData.stock, 10);
            const normalizedBrandId = formData.brandId.trim();
            const normalizedMainCategoryId = mainCategoryId.trim();
            const normalizedSubCategoryId = subCategoryId.trim();
            const normalizedCategoryIds = [
                ...(normalizedMainCategoryId ? [normalizedMainCategoryId] : []),
                ...(normalizedSubCategoryId ? [normalizedSubCategoryId] : []),
            ];
            const hasIncompleteAttributeValue = formData.attributeGroups.some((group) =>
                group.attributes.some((attribute) => {
                    const hasAnyValue = attribute.name.trim() || attribute.value.trim();
                    return Boolean(hasAnyValue) && !attribute.value.trim();
                })
            );

            if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
                toast.error("Enter a valid product price.");
                return;
            }

            if (!Number.isInteger(parsedStockQty) || parsedStockQty < 0) {
                toast.error("Enter a valid stock quantity.");
                return;
            }
            if (parsedDealerPrice != null && (!Number.isFinite(parsedDealerPrice) || parsedDealerPrice < 0)) {
                toast.error("Enter a valid dealer price.");
                return;
            }

            if (hasIncompleteAttributeValue) {
                toast.error("Each product detail row needs a value, or remove the incomplete row.");
                return;
            }

            const specsRecord: Record<string, string> = {};
            formData.filterSpecs.forEach(({ key, value }) => {
                const k = key.trim();
                if (k && featuredSpecKeys.includes(k)) specsRecord[k] = value.trim();
            });
            const {
                filterSpecs: _omit,
                categoryDiscountPercent: _omitCategoryDiscountPercent,
                discountPercent: _omitProductDiscountPercent,
                ...rest
            } = formData;

            const parsedProductDiscountPercent =
                formData.discountPercent.trim() === ""
                    ? null
                    : Math.max(0, Number(formData.discountPercent));

            const selectedCategoryId = normalizedSubCategoryId || normalizedMainCategoryId;
            const parsedCategoryDiscountPercent =
                formData.categoryDiscountPercent.trim() === ""
                    ? null
                    : Math.max(0, Number(formData.categoryDiscountPercent));
            const parsedInitialCategoryDiscountPercent =
                initialCategoryDiscountPercent.trim() === ""
                    ? null
                    : Math.max(0, Number(initialCategoryDiscountPercent));

            if (parsedProductDiscountPercent != null && !Number.isFinite(parsedProductDiscountPercent)) {
                toast.error("Enter a valid product discount amount.");
                return;
            }
            if (parsedCategoryDiscountPercent != null && !Number.isFinite(parsedCategoryDiscountPercent)) {
                toast.error("Enter a valid category discount amount.");
                return;
            }

            const payload = {
                ...rest,
                brandId: normalizedBrandId || undefined,
                categoryIds: normalizedCategoryIds.length ? normalizedCategoryIds : undefined,
                dealerPrice: parsedDealerPrice,
                discountPercent: parsedProductDiscountPercent,
                price: parsedPrice,
                stock: { qty: parsedStockQty },
                availability: formData.availability,
                warranty: formData.warranty?.trim() || undefined,
                specs: Object.keys(specsRecord).length ? specsRecord : undefined,
                colorVariants: formData.colorVariants
                    .filter((variant) => variant.name.trim())
                    .map((variant) => ({
                        name: variant.name.trim(),
                        hex: variant.hex.trim() || undefined,
                        image: variant.image?.trim() || undefined,
                        price: variant.price.trim() ? parseFloat(variant.price) : undefined,
                    })),
                attributeGroups: formData.attributeGroups
                    .filter((group) => group.category.trim() && group.attributes.some((attribute) => attribute.value.trim()))
                    .map((group) => ({
                        category: group.category.trim(),
                        attributes: group.attributes
                            .filter((attribute) => attribute.value.trim())
                            .map((attribute) => ({ name: attribute.name.trim(), value: attribute.value.trim() }))
                    })),
            };

            if (isNew) {
                const createdRes = await api.post("/admin/products", payload);
                const createdId: string | undefined =
                    createdRes?.data?._id || createdRes?.data?.id;
                if (selectedCategoryId && parsedCategoryDiscountPercent !== parsedInitialCategoryDiscountPercent) {
                    await api.put(`/admin/products/categories/${selectedCategoryId}/discount`, {
                        discountPercent: parsedCategoryDiscountPercent,
                    });
                }
                toast.success("Product saved successfully");
                if (createdId) notifyProductsListUpdated(createdId);
                router.push('/admin/products');
            } else {
                await api.patch(`/admin/products/${id}`, payload);
                if (selectedCategoryId && parsedCategoryDiscountPercent !== parsedInitialCategoryDiscountPercent) {
                    await api.put(`/admin/products/categories/${selectedCategoryId}/discount`, {
                        discountPercent: parsedCategoryDiscountPercent,
                    });
                }
                toast.success("Product saved successfully");
                notifyProductsListUpdated(id);
                setPreviewRefreshKey((prev) => prev + 1);
            }
        } catch (error) {
            console.error("Error saving product", error);
            toast.error(getApiErrorMessage(error));
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
            attributeGroups: [...formData.attributeGroups, { category: DEFAULT_ATTRIBUTE_GROUP_NAME, attributes: [] }]
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
            toast.error((err as Error).message);
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
                toast.error((err as Error).message);
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
            toast.error((err as Error).message);
        } finally {
            setImageUploading(null);
        }
    };

    const getFilterSpecValue = (specKey: string) =>
        formData.filterSpecs.find(s => s.key === specKey)?.value ?? "";

    const updateFilterSpecValue = (specKey: string, value: string) => {
        const next = formData.filterSpecs.filter(s => s.key !== specKey);
        if (value.length > 0) next.push({ key: specKey, value });
        setFormData({ ...formData, filterSpecs: next });
    };

    const removeFilterSpecByKey = (specKey: string) => {
        setFormData({ ...formData, filterSpecs: formData.filterSpecs.filter(s => s.key !== specKey) });
    };

    const clearAllFilterSpecValues = () => {
        if (featuredSpecKeys.length === 0) return;
        setFormData({
            ...formData,
            filterSpecs: formData.filterSpecs.filter((s) => !featuredSpecKeys.includes(s.key)),
        });
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
            toast.error("Failed to create brand");
        }
    };

    const handleEditBrand = async () => {
        if (!formData.brandId) {
            toast("Select a brand first");
            return;
        }
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
            toast.error("Failed to update brand");
        }
    };

    const handleAddCategory = async () => {
        const name = window.prompt("Enter new category name:");
        if (!name) return;
        const slug = normalizeCategorySlugInput(name);
        try {
            const { data: newCategory } = await api.post("/admin/products/categories", { name, slug });
            setCategories([...categories, newCategory]);
            const nextCategoryDiscount =
                newCategory?.discountPercent != null ? String(newCategory.discountPercent) : "";
            setInitialCategoryDiscountPercent(nextCategoryDiscount);
            setMainCategoryId(newCategory._id);
            setSubCategoryId("");
            setFormData((prev) => ({ ...prev, categoryDiscountPercent: nextCategoryDiscount }));
        } catch (e) {
            console.error(e);
            toast.error("Failed to create category");
        }
    };

    const handleEditCategory = async () => {
        const selectedCategoryId = subCategoryId || mainCategoryId;
        if (!selectedCategoryId) {
            toast("Select a category first");
            return;
        }
        const category = categories.find(c => c._id === selectedCategoryId);
        if (!category) return;
        const newName = window.prompt("Edit category name:", category.name);
        if (!newName || newName === category.name) return;
        const slug = normalizeCategorySlugInput(newName);
        try {
            const { data: updated } = await api.put(`/admin/products/categories/${category._id}`, { name: newName, slug });
            setCategories(categories.map(c => c._id === updated._id ? updated : c));
        } catch (e) {
            console.error(e);
            toast.error("Failed to update category");
        }
    };

    const addColorVariant = () => {
        setFormData((prev) => ({
            ...prev,
            colorVariants: [...prev.colorVariants, { name: "", hex: "", price: "" }],
        }));
    };

    const updateColorVariant = (index: number, field: keyof ColorVariant, value: string) => {
        setFormData((prev) => ({
            ...prev,
            colorVariants: prev.colorVariants.map((variant, i) => {
                if (i !== index) return variant;
                if (field === "name") {
                    const nextName = value;
                    // Auto-fill hex when it's empty, so user gets a friendly default.
                    const suggestedHex = suggestHexFromColorName(nextName);
                    if (!variant.hex && suggestedHex) {
                        return { ...variant, name: nextName, hex: suggestedHex };
                    }
                    return { ...variant, name: nextName };
                }
                return { ...variant, [field]: value };
            }),
        }));
    };

    const removeColorVariant = (index: number) => {
        setFormData((prev) => ({
            ...prev,
            colorVariants: prev.colorVariants.filter((_, i) => i !== index),
        }));
    };

    const handleColorVariantImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = "";
        setColorImageUploading(index);
        try {
            const oldUrl = formData.colorVariants[index]?.image;
            if (oldUrl?.includes("cloudinary.com")) {
                await deleteImageFromCloud(oldUrl);
            }
            const { url } = await uploadImage(file);
            setFormData((prev) => ({
                ...prev,
                colorVariants: prev.colorVariants.map((variant, i) =>
                    i === index ? { ...variant, image: url } : variant
                ),
            }));
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setColorImageUploading(null);
        }
    };

    const handleRemoveColorVariantImage = async (index: number) => {
        const url = formData.colorVariants[index]?.image;
        if (!url) return;
        if (url.includes("cloudinary.com")) {
            try {
                await deleteImageFromCloud(url);
            } catch (err) {
                toast.error((err as Error).message);
                return;
            }
        }
        setFormData((prev) => ({
            ...prev,
            colorVariants: prev.colorVariants.map((variant, i) =>
                i === index ? { ...variant, image: "" } : variant
            ),
        }));
    };

    if (initialLoading && !isNew) return <div className="p-10 text-center text-main">Loading...</div>;

    const sectionClass = "rounded-xl border border-border-soft bg-base/30 p-4 sm:p-6";
    const warrantyValueExists = WARRANTY_OPTIONS.includes(formData.warranty as (typeof WARRANTY_OPTIONS)[number]);

    return (
        <div className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href={returnToPath} className="rounded-lg border border-border-soft p-2 text-main transition-colors hover:bg-base">
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-sub">Admin / Products</p>
                        <h1 className="text-3xl font-bold text-main">{isNew ? "Create product" : "Edit product"}</h1>
                    </div>
                </div>
                <span className="rounded-full border border-border-soft bg-base px-3 py-1 text-xs text-sub">
                    {isNew ? "Draft mode" : "Update mode"}
                </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <section className="pb-2">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-main">Basic information</h2>
                        <p className="mt-1 text-sm text-sub">Core product details for catalog and pricing.</p>
                    </div>
                    <div className={`grid grid-cols-1 gap-6 ${!isNew ? "xl:grid-cols-2" : ""}`}>
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
                            <label className="text-sub text-sm">Dealer Price (LKR)</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                                value={formData.dealerPrice}
                                onChange={(e) => setFormData({ ...formData, dealerPrice: e.target.value })}
                                placeholder="Optional"
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
                            <label className="text-sub text-sm">Slug (Optional/Auto)</label>
                            <input
                                type="text"
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                                value={formData.slug}
                                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
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
                            <label className="text-sub text-sm">Warranty (Optional)</label>
                            <select
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                                value={formData.warranty}
                                onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                            >
                                <option value="">Select warranty</option>
                                {!warrantyValueExists && formData.warranty ? (
                                    <option value={formData.warranty}>
                                        {formData.warranty}
                                    </option>
                                ) : null}
                                {WARRANTY_OPTIONS.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sub text-sm">Availability Status</label>
                            <select
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-white"
                                value={formData.availability}
                                onChange={(e) => setFormData({ ...formData, availability: e.target.value as typeof formData.availability })}
                            >
                                <option value="coming_soon">Coming Soon</option>
                                <option value="in_stock">In Stock</option>
                                <option value="out_of_stock">Out of Stock</option>
                                <option value="pre_order">Pre-Order</option>
                            </select>
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
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-white"
                                value={formData.brandId}
                                onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                            >
                                <option value="">Select Brand</option>
                                {sortedBrands.map(b => (
                                    <option key={b._id} value={b._id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sub text-sm flex justify-between">
                                Main category
                                <div className="space-x-2">
                                    <button type="button" onClick={handleEditCategory} title="Edit Category" className="text-sub hover:text-main"><Edit2 className="w-4 h-4 inline" /></button>
                                    <button type="button" onClick={handleAddCategory} title="Add Category" className="text-blue-500 hover:text-blue-400"><Plus className="w-4 h-4 inline" /></button>
                                </div>
                            </label>
                            <select
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-white"
                                value={mainCategoryId}
                                onChange={(e) => {
                                    const nextMainCategoryId = e.target.value;
                                    setMainCategoryId(nextMainCategoryId);
                                    setSubCategoryId("");
                                    const cat = categories.find((c) => c._id === nextMainCategoryId);
                                    const nextCategoryDiscount =
                                        cat?.discountPercent != null ? String(cat.discountPercent) : "";
                                    setInitialCategoryDiscountPercent(nextCategoryDiscount);
                                    setFormData((prev) => ({
                                        ...prev,
                                        categoryDiscountPercent: nextCategoryDiscount,
                                    }));
                                }}
                            >
                                <option value="">Select Main Category</option>
                                {mainCategories.map((category) => (
                                    <option key={category._id} value={category._id}>{category.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sub text-sm">Sub category (optional)</label>
                            <select
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent [&>option]:text-white disabled:opacity-60"
                                value={subCategoryId}
                                disabled={!mainCategoryId}
                                onChange={(e) => {
                                    const nextSubCategoryId = e.target.value;
                                    setSubCategoryId(nextSubCategoryId);
                                    const selectedCategoryId = nextSubCategoryId || mainCategoryId;
                                    const cat = categories.find((c) => c._id === selectedCategoryId);
                                    const nextCategoryDiscount =
                                        cat?.discountPercent != null ? String(cat.discountPercent) : "";
                                    setInitialCategoryDiscountPercent(nextCategoryDiscount);
                                    setFormData((prev) => ({
                                        ...prev,
                                        categoryDiscountPercent: nextCategoryDiscount,
                                    }));
                                }}
                            >
                                <option value="">No sub category</option>
                                {subCategories.map((category) => (
                                    <option key={category._id} value={category._id}>{category.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                        {!isNew && (
                        <div className="rounded-xl border border-border-soft bg-base/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                <div>
                                    <h2 className="text-lg font-bold text-main">Shop page preview</h2>
                                    <p className="text-sub text-sm">Compact preview of the public product page.</p>
                                </div>
                                {previewPath && (
                                    <Link
                                        href={previewPath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 text-sm bg-accent/20 text-accent px-3 py-1.5 rounded hover:bg-accent/30 transition-colors"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Open full preview
                                    </Link>
                                )}
                            </div>
                            {previewPath ? (
                                <iframe
                                    title="Product shop preview"
                                    src={previewPath}
                                    className="w-full h-[420px] rounded-lg border border-border-soft bg-black"
                                />
                            ) : (
                                <p className="text-sub text-sm italic">Set a slug or save the product first to load preview.</p>
                            )}
                        </div>
                    )}
                    </div>
                </section>

                <section className="border-t border-border-soft pt-6">
                    <div className="mb-4">
                        <h2 className="text-xl font-bold text-main">Discounts</h2>
                        <p className="text-sub text-sm mt-0.5">
                            Set a product-level discount amount override, or set a category discount amount that applies to all products in the selected category.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sub text-sm">Product discount amount (LKR)</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent"
                                value={formData.discountPercent}
                                onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                                placeholder="e.g. 1000"
                            />
                            <p className="text-xs text-sub">Leave empty to use the category discount amount (if any).</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sub text-sm">Category discount amount (LKR)</label>
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                className="w-full bg-base border border-border-soft rounded-lg px-4 py-2 text-main focus:outline-none focus:border-accent disabled:opacity-60"
                                value={formData.categoryDiscountPercent}
                                onChange={(e) => setFormData({ ...formData, categoryDiscountPercent: e.target.value })}
                                placeholder="e.g. 1500"
                                disabled={!effectiveCategoryId}
                            />
                            <p className="text-xs text-sub">Leave empty to remove the category discount.</p>
                        </div>
                    </div>
                </section>

                <section className="border-t border-border-soft pt-6">
                    <label className="text-sub text-sm">Description</label>
                    <textarea
                        className="mt-2 h-32 w-full rounded-lg border border-border-soft bg-base px-4 py-2 text-main focus:outline-none focus:border-accent"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    ></textarea>
                </section>

                <section className="border-t border-border-soft pt-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl font-bold text-main">Color variants</h2>
                            <p className="text-sub text-sm mt-0.5">Add available colors for this product.</p>
                        </div>
                        <button
                            type="button"
                            onClick={addColorVariant}
                            className="text-sm bg-accent/20 text-accent px-3 py-1.5 rounded hover:bg-accent/30 transition-colors flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" /> Add color
                        </button>
                    </div>
                    {formData.colorVariants.length === 0 && (
                        <p className="text-sub text-sm italic">No color variants yet.</p>
                    )}
                    <div className="space-y-3">
                        {formData.colorVariants.map((variant, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-base border border-border-soft rounded-lg p-3">
                                <input
                                    type="text"
                                    placeholder="Color name (e.g. Black)"
                                    className="bg-base border border-border-soft rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent"
                                    value={variant.name}
                                    onChange={(e) => updateColorVariant(index, "name", e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="#000000"
                                    className="bg-base border border-border-soft rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent"
                                    value={variant.hex}
                                    onChange={(e) => updateColorVariant(index, "hex", e.target.value)}
                                />
                                <input
                                    type="color"
                                    className="h-[42px] w-full cursor-pointer rounded-lg border border-border-soft bg-base px-1 py-1"
                                    value={variant.hex && /^#[0-9A-Fa-f]{6}$/.test(variant.hex) ? variant.hex : "#000000"}
                                    onChange={(e) => updateColorVariant(index, "hex", e.target.value.toUpperCase())}
                                    title="Pick color"
                                />
                                <input
                                    type="number"
                                    placeholder="Variant price (optional)"
                                    className="bg-base border border-border-soft rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent"
                                    value={variant.price}
                                    onChange={(e) => updateColorVariant(index, "price", e.target.value)}
                                />
                                <div className="flex items-center gap-2">
                                    {colorImageUploading === index ? (
                                        <div className="flex h-[42px] w-[42px] items-center justify-center rounded border border-border-soft">
                                            <Loader2 className="h-4 w-4 animate-spin text-accent" />
                                        </div>
                                    ) : variant.image ? (
                                        <img src={variant.image} alt={`${variant.name} variant`} className="h-[42px] w-[42px] rounded border border-border-soft object-cover" />
                                    ) : (
                                        <div className="flex h-[42px] w-[42px] items-center justify-center rounded border border-dashed border-border-soft text-sub">
                                            <ImagePlus className="h-4 w-4" />
                                        </div>
                                    )}
                                    <label className="cursor-pointer rounded border border-border-soft px-2 py-1 text-xs text-sub hover:text-main hover:bg-base">
                                        {variant.image ? "Replace" : "Image"}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleColorVariantImageUpload(index, e)}
                                            disabled={colorImageUploading !== null}
                                        />
                                    </label>
                                    {variant.image && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveColorVariantImage(index)}
                                            className="rounded border border-border-soft px-2 py-1 text-xs text-red-400 hover:bg-red-400/10"
                                            title="Remove variant image"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => removeColorVariant(index)}
                                        className="w-full p-2 text-red-400 hover:bg-red-400/10 rounded border border-border-soft"
                                        title="Remove color"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Product images (Cloudinary) */}
                <section className="border-t border-border-soft pt-6">
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
                </section>

                {/* Filter Specs — only featured spec keys for the selected category */}
                <section className="border-t border-border-soft pt-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-main">Featured specs</h2>
                            <p className="text-sub text-sm mt-0.5">Set values for this category's featured specs to surface richer shop filters.</p>
                        </div>
                        {featuredSpecKeys.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs rounded-full border border-border-soft bg-base px-2.5 py-1 text-sub">
                                    {formData.filterSpecs.filter((s) => featuredSpecKeys.includes(s.key)).length}/{featuredSpecKeys.length} filled
                                </span>
                                <button
                                    type="button"
                                    onClick={clearAllFilterSpecValues}
                                    className="text-xs rounded-lg border border-border-soft px-3 py-1.5 text-sub hover:text-main hover:bg-base transition-colors"
                                >
                                    Clear all values
                                </button>
                            </div>
                        )}
                    </div>

                    {featuredSpecsLoading && (
                        <p className="text-sub text-sm italic">Loading featured specs for category…</p>
                    )}
                    {!featuredSpecsLoading && !effectiveCategoryId && (
                        <p className="text-sub text-sm italic">Select a category to see filter specs.</p>
                    )}
                    {!featuredSpecsLoading && effectiveCategoryId && featuredSpecKeys.length === 0 && (
                        <p className="text-sub text-sm italic">No featured specs for this category. Configure them under Admin → Categories → Featured Specs.</p>
                    )}
                    {!featuredSpecsLoading && featuredSpecKeys.length > 0 && (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            {featuredSpecKeys.map((specKey) => {
                                const specValue = getFilterSpecValue(specKey);
                                const hasValue = specValue.trim().length > 0;
                                const allSuggestions = specSuggestions[specKey] || [];
                                const filteredSuggestions = specValue.trim()
                                    ? allSuggestions.filter((s) => s.toLowerCase().includes(specValue.toLowerCase()))
                                    : allSuggestions;
                                const isDropdownOpen = activeSpecKey === specKey && filteredSuggestions.length > 0;
                                return (
                                    <div
                                        key={specKey}
                                        className={`rounded-lg border p-3 transition-colors ${hasValue ? "border-accent/40 bg-accent/5" : "border-border-soft bg-base/60"}`}
                                    >
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <div>
                                                <p className="text-main text-sm font-semibold">{formatSpecLabel(specKey)}</p>
                                                <p className="text-sub text-[11px]">{specKey}</p>
                                            </div>
                                            {hasValue ? (
                                                <span className="text-[11px] rounded-full bg-accent/20 text-accent px-2 py-0.5">Filled</span>
                                            ) : (
                                                <span className="text-[11px] rounded-full bg-base text-sub border border-border-soft px-2 py-0.5">Empty</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder={`Enter ${formatSpecLabel(specKey).toLowerCase()}`}
                                                    className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-accent"
                                                    value={specValue}
                                                    onFocus={() => setActiveSpecKey(specKey)}
                                                    onBlur={() => setTimeout(() => setActiveSpecKey(null), 150)}
                                                    onChange={(e) => updateFilterSpecValue(specKey, e.target.value)}
                                                />
                                                {isDropdownOpen && (
                                                    <ul className="absolute z-50 left-0 right-0 mt-1 bg-surface border border-border-soft rounded-lg shadow-lg max-h-44 overflow-y-auto">
                                                        {filteredSuggestions.map((suggestion) => (
                                                            <li
                                                                key={suggestion}
                                                                onMouseDown={() => {
                                                                    updateFilterSpecValue(specKey, suggestion);
                                                                    setActiveSpecKey(null);
                                                                }}
                                                                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${suggestion === specValue ? "bg-accent/15 text-accent" : "text-main hover:bg-accent/10"}`}
                                                            >
                                                                {suggestion}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeFilterSpecByKey(specKey)}
                                                disabled={!hasValue}
                                                className="p-2 text-red-400 hover:bg-red-400/10 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                                                title="Clear value"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Product details — attribute groups (e.g. General, Cable Specs) */}
                <section className="border-t border-border-soft pt-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold text-main">Product details (Attributes)</h2>
                            <p className="mt-0.5 text-sm text-sub">Group details by category (General, Cable Specs, etc.) and update values quickly.</p>
                            <p className="mt-1 text-xs text-sub">
                                {formData.attributeGroups.length} categories,{" "}
                                {formData.attributeGroups.reduce((sum, g) => sum + g.attributes.length, 0)} total attributes
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={addAttributeGroup}
                            className="inline-flex items-center gap-2 rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent transition-colors hover:bg-accent/25"
                        >
                            <Plus className="h-4 w-4" /> Add category
                        </button>
                    </div>

                    {formData.attributeGroups.length === 0 && (
                        <p className="text-sub text-sm italic">No attribute categories. Click &quot;Add category&quot; to add one (e.g. General, Cable Specs).</p>
                    )}

                    {selectedAttributeKeys.size > 0 && formData.attributeGroups.length > 0 && (
                        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 p-3">
                            <span className="text-sm font-medium text-main">
                                {selectedAttributeKeys.size} attribute{selectedAttributeKeys.size !== 1 ? "s" : ""} selected
                            </span>
                            <select
                                id="move-target-category"
                                className="bg-base border border-border-soft rounded-lg px-3 py-1.5 text-sm text-main focus:outline-none focus:border-accent [&>option]:text-white"
                            >
                                <option value="">Move to category…</option>
                                {sortedAttributeGroupTargets.map((target) => (
                                    <option key={target.index} value={target.index}>
                                        {target.label}
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
                                className="inline-flex items-center gap-1.5 rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent/90"
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

                    <div className="space-y-4">
                        {formData.attributeGroups.map((group, groupIndex) => (
                            <div key={groupIndex} className="rounded-xl border border-border-soft bg-base/60 p-4">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                    <div className="flex w-12 shrink-0 flex-col gap-0.5">
                                        <button
                                            type="button"
                                            onClick={() => moveGroupUp(groupIndex)}
                                            disabled={groupIndex === 0}
                                            className="rounded p-1 text-sub hover:bg-white/5 hover:text-main disabled:pointer-events-none disabled:opacity-40"
                                            title="Move category up"
                                        >
                                            <ChevronUp className="h-4 w-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveGroupDown(groupIndex)}
                                            disabled={groupIndex === formData.attributeGroups.length - 1}
                                            className="rounded p-1 text-sub hover:bg-white/5 hover:text-main disabled:pointer-events-none disabled:opacity-40"
                                            title="Move category down"
                                        >
                                            <ChevronDown className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="Category name (e.g. General, Cable Specs)"
                                        className="min-w-[220px] flex-1 rounded-lg border border-border-soft bg-base px-3 py-2 text-main font-medium focus:border-accent focus:outline-none"
                                        value={group.category}
                                        onChange={(e) => updateGroupCategory(groupIndex, e.target.value)}
                                    />
                                    <span className="rounded-full border border-border-soft px-2.5 py-1 text-xs text-sub">
                                        {group.attributes.length} item{group.attributes.length === 1 ? "" : "s"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttributeGroup(groupIndex)}
                                        className="shrink-0 rounded p-2 text-red-400 hover:bg-red-400/10"
                                        title="Remove category"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </button>
                                </div>
                                {group.attributes.length > 0 && (
                                    <div className="mb-2 flex items-center gap-2">
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

                                <div className="space-y-2">
                                    {group.attributes.length > 0 && (
                                        <div className="mb-2 hidden gap-2 px-1 text-xs uppercase tracking-wider text-sub lg:flex">
                                            <span className="w-14 shrink-0">Select</span>
                                            <span className="w-16 shrink-0">Order</span>
                                            <span className="flex-1">Name</span>
                                            <span className="flex-1">Value</span>
                                            <span className="w-8 shrink-0" />
                                        </div>
                                    )}
                                    {group.attributes.map((attr, attrIndex) => (
                                        <div
                                            key={attrIndex}
                                            className={`grid grid-cols-1 items-center gap-2 rounded-lg border border-border-soft p-2 lg:grid-cols-[auto_auto_1fr_1fr_auto] ${isAttributeSelected(groupIndex, attrIndex) ? "border-accent/50 bg-accent/10" : "bg-base/40"}`}
                                        >
                                            <div className="flex items-center justify-between lg:hidden">
                                                <span className="text-xs font-medium text-sub">Attribute {attrIndex + 1}</span>
                                            </div>
                                            <label className="flex w-14 shrink-0 cursor-pointer items-center" title="Select to move to another category">
                                                <input
                                                    type="checkbox"
                                                    checked={isAttributeSelected(groupIndex, attrIndex)}
                                                    onChange={() => toggleAttributeSelection(groupIndex, attrIndex)}
                                                    className="w-4 h-4 rounded border-gray-500 text-accent focus:ring-accent"
                                                />
                                            </label>
                                            <div className="flex w-16 shrink-0 flex-col gap-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => moveAttributeUp(groupIndex, attrIndex)}
                                                    disabled={attrIndex === 0}
                                                    className="rounded p-1.5 text-sub hover:bg-white/5 hover:text-main disabled:pointer-events-none disabled:opacity-40"
                                                    title="Move up"
                                                >
                                                    <ChevronUp className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveAttributeDown(groupIndex, attrIndex)}
                                                    disabled={attrIndex === group.attributes.length - 1}
                                                    className="rounded p-1.5 text-sub hover:bg-white/5 hover:text-main disabled:pointer-events-none disabled:opacity-40"
                                                    title="Move down"
                                                >
                                                    <ChevronDown className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Name (e.g. Color)"
                                                className="flex-1 bg-base border border-border-soft rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-accent min-w-0"
                                                value={attr.name ?? ''}
                                                onChange={(e) => updateAttribute(groupIndex, attrIndex, "name", e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Value (e.g. Red)"
                                                className="flex-1 bg-base border border-border-soft rounded-lg px-3 py-2 text-main text-sm focus:outline-none focus:border-accent min-w-0"
                                                value={attr.value ?? ''}
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
                                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-accent transition-colors hover:bg-accent/10"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add property
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="border-t border-border-soft pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-base/20 p-3 sm:p-4">
                    <label htmlFor="isActive" className="flex items-center gap-2 text-main">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Active Product
                    </label>
                    <button
                        type="submit"
                        disabled={loading}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-2 text-white transition-colors hover:bg-accent/90 disabled:opacity-50 sm:w-auto"
                    >
                        <Save className="h-5 w-5" />
                        {loading ? 'Saving...' : 'Save Product'}
                    </button>
                    </div>
                </section>
            </form>
        </div>
    );
}
