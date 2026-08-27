"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, Check, Tag, Image as ImageIcon } from "lucide-react";
import api from "@/lib/api";
import Image from "next/image";
import PopupDialog from "@/components/PopupDialog";
import PageHeader from "@/components/admin/PageHeader";
import Toggle from "@/components/admin/Toggle";
import ImageDropzone from "@/components/admin/ImageDropzone";
import type { StatusTone } from "@/components/admin/StatusBadge";

interface Promotion {
    _id: string;
    title: string;
    description: string;
    imageUrl: string;
    link: string;
    badgeText: string;
    validFrom: string;
    validTo: string;
    isActive: boolean;
    sortOrder: number;
    directRedirect: boolean;
}

const EMPTY: Omit<Promotion, "_id"> = {
    title: "",
    description: "",
    imageUrl: "",
    link: "",
    badgeText: "",
    validFrom: "",
    validTo: "",
    isActive: true,
    sortOrder: 0,
    directRedirect: false,
};

function toDatetimeLocal(iso: string): string {
    if (!iso) return "";
    return new Date(iso).toISOString().slice(0, 16);
}

function isOngoing(promo: Promotion): boolean {
    const now = Date.now();
    return promo.isActive &&
        new Date(promo.validFrom).getTime() <= now &&
        new Date(promo.validTo).getTime() >= now;
}

function promoTone(promo: Promotion): StatusTone {
    if (isOngoing(promo)) return "success";
    if (promo.isActive) return "warning";
    return "neutral";
}

const toneButtonClasses: Record<StatusTone, string> = {
    success: "bg-success/15 text-success hover:bg-success/25",
    warning: "bg-warning/15 text-warning hover:bg-warning/25",
    danger: "bg-danger/15 text-danger hover:bg-danger/25",
    info: "bg-info/15 text-info hover:bg-info/25",
    neutral: "bg-base text-sub hover:bg-white/5",
};

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Promotion | null>(null);
    const [form, setForm] = useState<Omit<Promotion, "_id">>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [promotionToDeleteId, setPromotionToDeleteId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/promotions");
            setPromotions(data);
        } catch {
            setError("Failed to load promotions.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY);
        setError("");
        setShowForm(true);
    };

    const openEdit = (promo: Promotion) => {
        setEditing(promo);
        setForm({
            title: promo.title,
            description: promo.description,
            imageUrl: promo.imageUrl,
            link: promo.link,
            badgeText: promo.badgeText,
            validFrom: toDatetimeLocal(promo.validFrom),
            validTo: toDatetimeLocal(promo.validTo),
            isActive: promo.isActive,
            sortOrder: promo.sortOrder,
            directRedirect: promo.directRedirect ?? false,
        });
        setError("");
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
    };

    const handleUpload = async (file: File) => {
        const fd = new FormData();
        fd.append("image", file);
        setUploading(true);
        try {
            const { data } = await api.post("/admin/upload/image", fd);
            setForm(f => ({ ...f, imageUrl: data.url }));
        } catch {
            setError("Image upload failed.");
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setError("");
        if (!form.title.trim()) { setError("Title is required."); return; }
        if (!form.validFrom) { setError("Start date is required."); return; }
        if (!form.validTo) { setError("End date is required."); return; }
        if (new Date(form.validFrom) >= new Date(form.validTo)) {
            setError("End date must be after start date.");
            return;
        }

        setSaving(true);
        try {
            if (editing) {
                await api.put(`/promotions/${editing._id}`, form);
            } else {
                await api.post("/promotions", form);
            }
            closeForm();
            load();
        } catch (err: any) {
            setError(err?.response?.data?.error?.message || "Save failed.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/promotions/${id}`);
            load();
        } catch {
            setError("Delete failed.");
        }
    };

    const toggleActive = async (promo: Promotion) => {
        try {
            await api.put(`/promotions/${promo._id}`, { isActive: !promo.isActive });
            load();
        } catch {
            setError("Update failed.");
        }
    };

    return (
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <PageHeader
                title="Promotions"
                subtitle="Manage promotional banners shown on the home page."
                action={
                    <button
                        onClick={openCreate}
                        className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4" />
                        New Promotion
                    </button>
                }
            />

            {error && !showForm && (
                <div className="mb-6 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">{error}</div>
            )}

            {/* Modal Form */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-surface border border-border-soft shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft">
                            <h2 className="text-lg font-bold text-main">
                                {editing ? "Edit Promotion" : "New Promotion"}
                            </h2>
                            <button onClick={closeForm} className="text-sub hover:text-main transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">{error}</div>
                            )}

                            <ImageDropzone
                                label="Promotion Image"
                                value={form.imageUrl}
                                onUploadFile={handleUpload}
                                onUrlChange={(url) => setForm(f => ({ ...f, imageUrl: url }))}
                                onClear={() => setForm(f => ({ ...f, imageUrl: "" }))}
                                uploading={uploading}
                                previewAspect="cover"
                                height="h-36"
                                uploadHint="Click to upload image"
                            />

                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Title *</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                    placeholder="e.g. End of Season Sale"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Description</label>
                                <textarea
                                    rows={2}
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent resize-none"
                                    placeholder="Short description shown on the card"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Badge Text</label>
                                    <input
                                        type="text"
                                        value={form.badgeText}
                                        onChange={e => setForm(f => ({ ...f, badgeText: e.target.value }))}
                                        className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                        placeholder="e.g. 20% OFF"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Sort Order</label>
                                    <input
                                        type="number"
                                        value={form.sortOrder}
                                        onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))}
                                        className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Link URL</label>
                                <input
                                    type="text"
                                    value={form.link}
                                    onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
                                    className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                    placeholder="e.g. /shop?tag=sale (optional)"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Start Date *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.validFrom}
                                        onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
                                        className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent [color-scheme:dark]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">End Date *</label>
                                    <input
                                        type="datetime-local"
                                        value={form.validTo}
                                        onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))}
                                        className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main focus:outline-none focus:border-accent [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            <Toggle
                                layout="inline"
                                checked={form.isActive}
                                onChange={(next) => setForm(f => ({ ...f, isActive: next }))}
                                label="Active"
                            />

                            <Toggle
                                layout="inline"
                                checked={form.directRedirect}
                                onChange={(next) => setForm(f => ({ ...f, directRedirect: next }))}
                                label="Direct Redirect"
                                description="If enabled, clicking the promotion redirects immediately instead of showing details."
                            />
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-soft">
                            <button onClick={closeForm} className="px-4 py-2 rounded-lg border border-border-soft text-sub hover:text-main transition-colors text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-accent hover:bg-accent/90 text-white text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                                <Check className="h-4 w-4" />
                                {saving ? "Saving…" : editing ? "Update" : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="admin-card rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-sub">Loading…</div>
                ) : promotions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Tag className="h-10 w-10 text-sub/40" />
                        <p className="text-sub">No promotions yet. Create your first one.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-base text-sub uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-4 w-16">Image</th>
                                    <th className="px-5 py-4">Title</th>
                                    <th className="px-5 py-4">Badge</th>
                                    <th className="px-5 py-4">Valid From</th>
                                    <th className="px-5 py-4">Valid To</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-soft text-main">
                                {promotions.map(promo => (
                                    <tr key={promo._id} className="hover:bg-base/50 transition-colors">
                                        <td className="px-5 py-3">
                                            {promo.imageUrl ? (
                                                <div className="relative h-10 w-16 rounded-md overflow-hidden bg-base shrink-0">
                                                    <Image src={promo.imageUrl} alt={promo.title} fill className="object-cover" sizes="64px" />
                                                </div>
                                            ) : (
                                                <div className="flex h-10 w-16 items-center justify-center rounded-md bg-base">
                                                    <ImageIcon className="h-4 w-4 text-sub/50" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="font-medium line-clamp-1">{promo.title}</div>
                                            {promo.description && (
                                                <div className="text-xs text-sub line-clamp-1 mt-0.5">{promo.description}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-3">
                                            {promo.badgeText ? (
                                                <span className="rounded-full bg-accent/20 text-accent px-2.5 py-0.5 text-xs font-semibold">{promo.badgeText}</span>
                                            ) : <span className="text-sub">—</span>}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-sub whitespace-nowrap">
                                            {new Date(promo.validFrom).toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-sub whitespace-nowrap">
                                            {new Date(promo.validTo).toLocaleString()}
                                        </td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => toggleActive(promo)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${toneButtonClasses[promoTone(promo)]}`}
                                            >
                                                {isOngoing(promo) ? "Live" : promo.isActive ? "Scheduled" : "Inactive"}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(promo)}
                                                    className="p-2 hover:bg-base rounded-lg text-accent transition-colors"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setPromotionToDeleteId(promo._id)}
                                                    className="p-2 hover:bg-base rounded-lg text-danger transition-colors"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <PopupDialog
                open={Boolean(promotionToDeleteId)}
                title="Delete promotion"
                message="Are you sure you want to delete this promotion?"
                tone="danger"
                confirmText="Delete"
                cancelText="Cancel"
                onClose={() => setPromotionToDeleteId(null)}
                onConfirm={() => {
                    if (!promotionToDeleteId) return;
                    const id = promotionToDeleteId;
                    setPromotionToDeleteId(null);
                    void handleDelete(id);
                }}
            />
        </div>
    );
}
