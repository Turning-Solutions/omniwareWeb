"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, X, Check, Tag, Image as ImageIcon, Upload } from "lucide-react";
import api from "@/lib/api";
import Image from "next/image";

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

export default function PromotionsPage() {
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Promotion | null>(null);
    const [form, setForm] = useState<Omit<Promotion, "_id">>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

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
        });
        setError("");
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditing(null);
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
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
            if (fileRef.current) fileRef.current.value = "";
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
        if (!confirm("Delete this promotion?")) return;
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-main">Promotions</h1>
                    <p className="text-sub mt-1 text-sm">Manage promotional banners shown on the home page.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                    <Plus className="h-4 w-4" />
                    New Promotion
                </button>
            </div>

            {error && !showForm && (
                <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">{error}</div>
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
                                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">{error}</div>
                            )}

                            {/* Image preview & upload */}
                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Promotion Image</label>
                                {form.imageUrl ? (
                                    <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border-soft mb-2">
                                        <Image src={form.imageUrl} alt="Preview" fill className="object-cover" sizes="512px" />
                                        <button
                                            onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                                            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileRef.current?.click()}
                                        className="flex h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-soft bg-base hover:border-accent transition-colors mb-2"
                                    >
                                        {uploading ? (
                                            <span className="text-sm text-sub">Uploading…</span>
                                        ) : (
                                            <>
                                                <Upload className="h-6 w-6 text-sub mb-1" />
                                                <span className="text-sm text-sub">Click to upload image</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                                <div className="flex items-center gap-2 mt-1">
                                    <ImageIcon className="h-4 w-4 text-sub shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="Or paste image URL"
                                        value={form.imageUrl}
                                        onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                                        className="flex-1 bg-base border border-border-soft rounded-lg px-3 py-1.5 text-sm text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                    />
                                </div>
                            </div>

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

                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div
                                    onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                                    className={`relative h-6 w-11 rounded-full transition-colors ${form.isActive ? "bg-accent" : "bg-[#3a3a3a]"}`}
                                >
                                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"}`} />
                                </div>
                                <span className="text-sm text-main">Active</span>
                            </label>
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
                                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                                    isOngoing(promo)
                                                        ? "bg-green-500/20 text-green-400"
                                                        : promo.isActive
                                                        ? "bg-yellow-500/20 text-yellow-400"
                                                        : "bg-red-500/20 text-red-400"
                                                }`}
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
                                                    onClick={() => handleDelete(promo._id)}
                                                    className="p-2 hover:bg-base rounded-lg text-red-400 transition-colors"
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
        </div>
    );
}
