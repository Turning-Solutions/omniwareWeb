"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import api from "@/lib/api";
import { isAxiosError } from "axios";
import PopupDialog from "@/components/PopupDialog";

interface Category {
    _id: string;
    name: string;
    slug: string;
    parentId?: string | null;
}

function getApiErrorMessage(error: unknown, fallback: string) {
    if (isAxiosError(error) && typeof error.response?.data?.message === "string") {
        return error.response.data.message;
    }
    return fallback;
}

function getApiStatus(error: unknown): number | undefined {
    if (isAxiosError(error)) return error.response?.status;
    return undefined;
}

const sortByName = <T extends { name: string }>(items: T[]) =>
    [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

export default function CategoryManagerPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingCreate, setSavingCreate] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);

    const [newName, setNewName] = useState("");
    const [newParentId, setNewParentId] = useState("");

    const [selectedEditId, setSelectedEditId] = useState("");
    const [editName, setEditName] = useState("");
    const [editParentId, setEditParentId] = useState("");
    const [pendingUpdateConfirm, setPendingUpdateConfirm] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

    const [popupInfo, setPopupInfo] = useState<{ title: string; message: string; tone: "success" | "danger" } | null>(null);

    const fetchCategories = async () => {
        try {
            const { data } = await api.get("/products/categories");
            setCategories(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch categories", error);
            setPopupInfo({
                title: "Load failed",
                message: "Could not load categories.",
                tone: "danger",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchCategories();
    }, []);

    const mainCategories = useMemo(
        () => sortByName(categories.filter((category) => !category.parentId)),
        [categories]
    );

    const sortedCategories = useMemo(() => sortByName(categories), [categories]);

    const subcategoriesByParent = useMemo(() => {
        const map = new Map<string, Category[]>();
        categories
            .filter((category) => category.parentId)
            .forEach((subcategory) => {
                const key = String(subcategory.parentId);
                const existing = map.get(key) || [];
                map.set(key, [...existing, subcategory]);
            });
        return map;
    }, [categories]);

    const selectedEditCategory = categories.find((category) => category._id === selectedEditId) || null;

    useEffect(() => {
        if (!selectedEditCategory) {
            setEditName("");
            setEditParentId("");
            return;
        }
        setEditName(selectedEditCategory.name);
        setEditParentId(selectedEditCategory.parentId || "");
    }, [selectedEditCategory]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setSavingCreate(true);
        try {
            await api.post("/admin/products/categories", {
                name: newName.trim(),
                parentId: newParentId || null,
            });
            setNewName("");
            setNewParentId("");
            await fetchCategories();
            setPopupInfo({
                title: "Category created",
                message: "The category has been added successfully.",
                tone: "success",
            });
        } catch (error) {
            console.error("Failed to create category", error);
            setPopupInfo({
                title: "Create failed",
                message: "Could not create category. Check duplicate names/slugs.",
                tone: "danger",
            });
        } finally {
            setSavingCreate(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEditId || !editName.trim()) return;
        setPendingUpdateConfirm(true);
    };

    const executeUpdate = async () => {
        if (!selectedEditId || !editName.trim()) return;
        setSavingEdit(true);
        try {
            await api.put(`/admin/products/categories/${selectedEditId}`, {
                name: editName.trim(),
                parentId: editParentId || null,
            });
            await fetchCategories();
            setPopupInfo({
                title: "Category updated",
                message: "Category details were saved.",
                tone: "success",
            });
        } catch (error) {
            const status = getApiStatus(error);
            setPopupInfo({
                title: status === 409 ? "Update blocked" : "Update failed",
                message: getApiErrorMessage(error, "Could not update category."),
                tone: "danger",
            });
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDelete = async () => {
        if (!categoryToDelete?._id) return;
        try {
            await api.delete(`/admin/products/categories/${categoryToDelete._id}`);
            await fetchCategories();
            if (selectedEditId === categoryToDelete._id) {
                setSelectedEditId("");
            }
            setPopupInfo({
                title: "Category deleted",
                message: `"${categoryToDelete.name}" was deleted successfully.`,
                tone: "success",
            });
        } catch (error) {
            const status = getApiStatus(error);
            setPopupInfo({
                title: status === 409 ? "Delete blocked" : "Delete failed",
                message: getApiErrorMessage(error, "Could not delete category."),
                tone: "danger",
            });
        } finally {
            setCategoryToDelete(null);
        }
    };

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-main">Category Manager</h1>
                <p className="mt-1 text-sm text-sub">
                    Create categories, add subcategories, and change parent-child structure.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <section className="rounded-xl border border-border-soft bg-base/20 p-5">
                    <h2 className="text-lg font-semibold text-main">Add category / subcategory</h2>
                    <p className="mt-1 text-sm text-sub">Select a parent to create a subcategory. Leave empty for main category.</p>
                    <form onSubmit={handleCreate} className="mt-4 space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-sm text-sub">Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="w-full rounded-lg border border-border-soft bg-base px-4 py-2 text-main focus:border-accent focus:outline-none"
                                placeholder="e.g. Motherboards"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm text-sub">Parent category (optional)</label>
                            <select
                                value={newParentId}
                                onChange={(e) => setNewParentId(e.target.value)}
                                className="w-full rounded-lg border border-border-soft bg-base px-4 py-2 text-main focus:border-accent focus:outline-none [&>option]:text-white"
                            >
                                <option value="">No parent (main category)</option>
                                {mainCategories.map((category) => (
                                    <option key={category._id} value={category._id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="submit"
                            disabled={savingCreate}
                            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-white hover:bg-accent/90 disabled:opacity-50"
                        >
                            <Plus className="h-4 w-4" />
                            {savingCreate ? "Saving..." : "Create"}
                        </button>
                    </form>
                </section>

                <section className="rounded-xl border border-border-soft bg-base/20 p-5">
                    <h2 className="text-lg font-semibold text-main">Edit category</h2>
                    <p className="mt-1 text-sm text-sub">Rename categories or move a category under a different parent.</p>
                    <form onSubmit={handleUpdate} className="mt-4 space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-sm text-sub">Select category</label>
                            <select
                                value={selectedEditId}
                                onChange={(e) => setSelectedEditId(e.target.value)}
                                className="w-full rounded-lg border border-border-soft bg-base px-4 py-2 text-main focus:border-accent focus:outline-none [&>option]:text-white"
                            >
                                <option value="">Choose category...</option>
                                {sortedCategories.map((category) => (
                                    <option key={category._id} value={category._id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm text-sub">Name</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                disabled={!selectedEditId}
                                className="w-full rounded-lg border border-border-soft bg-base px-4 py-2 text-main focus:border-accent focus:outline-none disabled:opacity-60"
                                required={Boolean(selectedEditId)}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm text-sub">Parent category</label>
                            <select
                                value={editParentId}
                                onChange={(e) => setEditParentId(e.target.value)}
                                disabled={!selectedEditId}
                                className="w-full rounded-lg border border-border-soft bg-base px-4 py-2 text-main focus:border-accent focus:outline-none [&>option]:text-white disabled:opacity-60"
                            >
                                <option value="">No parent (main category)</option>
                                {mainCategories
                                    .filter((category) => category._id !== selectedEditId)
                                    .map((category) => (
                                        <option key={category._id} value={category._id}>
                                            {category.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={!selectedEditId || savingEdit}
                            className="inline-flex items-center gap-2 rounded-lg border border-border-soft px-4 py-2 text-main hover:bg-base disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" />
                            {savingEdit ? "Updating..." : "Update"}
                        </button>
                    </form>
                </section>
            </div>

            <section className="mt-6 rounded-xl border border-border-soft bg-base/20 p-5">
                <h2 className="text-lg font-semibold text-main">Current category tree</h2>
                {loading ? (
                    <p className="mt-3 text-sm text-sub">Loading categories...</p>
                ) : mainCategories.length === 0 ? (
                    <p className="mt-3 text-sm text-sub">No categories found.</p>
                ) : (
                    <div className="mt-4 space-y-3">
                        {mainCategories.map((mainCategory) => {
                            const subs = subcategoriesByParent.get(mainCategory._id) || [];
                            return (
                                <div key={mainCategory._id} className="rounded-lg border border-border-soft bg-base/40 p-3">
                                    <p className="font-medium text-main">{mainCategory.name}</p>
                                    {subs.length === 0 ? (
                                        <p className="mt-1 text-sm text-sub">No subcategories</p>
                                    ) : (
                                        <div className="mt-2 space-y-2">
                                            {subs.map((subcategory) => (
                                                <div
                                                    key={subcategory._id}
                                                    className="rounded-lg border border-border-soft px-2.5 py-1.5 text-xs text-sub"
                                                >
                                                    <span>{subcategory.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <PopupDialog
                open={pendingUpdateConfirm}
                title="Confirm category update"
                message="Are you sure you want to update this category?"
                tone="info"
                confirmText="Update"
                cancelText="Cancel"
                onClose={() => setPendingUpdateConfirm(false)}
                onConfirm={() => {
                    setPendingUpdateConfirm(false);
                    void executeUpdate();
                }}
            />
            <PopupDialog
                open={Boolean(categoryToDelete)}
                title="Delete category"
                message={
                    categoryToDelete
                        ? `Are you sure you want to delete "${categoryToDelete.name}"? If products are linked to this category, delete will be blocked.`
                        : ""
                }
                tone="danger"
                confirmText="Delete"
                cancelText="Cancel"
                onClose={() => setCategoryToDelete(null)}
                onConfirm={() => {
                    void handleDelete();
                }}
            />
            <PopupDialog
                open={Boolean(popupInfo)}
                title={popupInfo?.title || ""}
                message={popupInfo?.message || ""}
                tone={popupInfo?.tone || "info"}
                confirmText="OK"
                onClose={() => setPopupInfo(null)}
                onConfirm={() => setPopupInfo(null)}
            />
        </div>
    );
}
