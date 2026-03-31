"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Check, Handshake, Upload, Image as ImageIcon } from "lucide-react";
import api from "@/lib/api";
import PopupDialog from "@/components/PopupDialog";
import Image from "next/image";

interface Partner {
    _id: string;
    name: string;
    logoUrl: string;
    isActive: boolean;
    sortOrder: number;
}

const EMPTY: Omit<Partner, "_id"> = {
    name: "",
    logoUrl: "",
    isActive: true,
    sortOrder: 0,
};

export default function PartnersPage() {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Partner | null>(null);
    const [form, setForm] = useState<Omit<Partner, "_id">>(EMPTY);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [uploading, setUploading] = useState(false);
    const [partnerToDeleteId, setPartnerToDeleteId] = useState<string | null>(null);
    const [fileInputKey, setFileInputKey] = useState(0);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/partners");
            setPartners(data);
        } catch {
            setError("Failed to load partners.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY);
        setError("");
        setShowForm(true);
    };

    const openEdit = (partner: Partner) => {
        setEditing(partner);
        setForm({
            name: partner.name,
            logoUrl: partner.logoUrl,
            isActive: partner.isActive,
            sortOrder: partner.sortOrder,
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

        const formData = new FormData();
        formData.append("image", file);
        setUploading(true);
        try {
            const { data } = await api.post("/admin/upload/image", formData);
            setForm((f) => ({ ...f, logoUrl: data.url }));
        } catch {
            setError("Image upload failed.");
        } finally {
            setUploading(false);
            setFileInputKey((prev) => prev + 1);
        }
    };

    const handleSave = async () => {
        setError("");
        if (!form.name.trim()) {
            setError("Partner name is required.");
            return;
        }

        setSaving(true);
        try {
            if (editing) {
                await api.put(`/partners/${editing._id}`, form);
            } else {
                await api.post("/partners", form);
            }
            closeForm();
            await load();
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { error?: { message?: string } } } };
            setError(apiError?.response?.data?.error?.message || "Save failed.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/partners/${id}`);
            await load();
        } catch {
            setError("Delete failed.");
        }
    };

    const toggleActive = async (partner: Partner) => {
        try {
            await api.put(`/partners/${partner._id}`, { isActive: !partner.isActive });
            await load();
        } catch {
            setError("Update failed.");
        }
    };

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-main">Partners</h1>
                    <p className="text-sub mt-1 text-sm">Manage brands shown in the home page partnership strip.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
                >
                    <Plus className="h-4 w-4" />
                    Add Partner
                </button>
            </div>

            {error && !showForm && (
                <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-surface border border-border-soft shadow-2xl overflow-y-auto max-h-[90vh]">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft">
                            <h2 className="text-lg font-bold text-main">{editing ? "Edit Partner" : "New Partner"}</h2>
                            <button onClick={closeForm} className="text-sub hover:text-main transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            {error && (
                                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">{error}</div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                    placeholder="e.g. AMD"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Partner Logo</label>
                                {form.logoUrl ? (
                                    <div className="relative w-full h-28 rounded-xl overflow-hidden border border-border-soft mb-2 bg-base">
                                        <Image src={form.logoUrl} alt="Partner logo preview" fill className="object-contain p-3" sizes="512px" />
                                        <button
                                            onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                                            className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                                            type="button"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ) : (
                                    <label className="flex h-24 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-soft bg-base hover:border-accent transition-colors mb-2">
                                        {uploading ? (
                                            <span className="text-sm text-sub">Uploading...</span>
                                        ) : (
                                            <>
                                                <Upload className="h-6 w-6 text-sub mb-1" />
                                                <span className="text-sm text-sub">Click to upload logo</span>
                                            </>
                                        )}
                                        <input
                                            key={fileInputKey}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleUpload}
                                        />
                                    </label>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <ImageIcon className="h-4 w-4 text-sub shrink-0" />
                                    <input
                                        type="text"
                                        value={form.logoUrl}
                                        onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                                        className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                        placeholder="Or paste image URL"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Sort Order</label>
                                <input
                                    type="number"
                                    value={form.sortOrder}
                                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                                    className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                />
                            </div>

                            <label className="flex items-center gap-3 cursor-pointer select-none">
                                <div
                                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
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
                                {saving ? "Saving..." : editing ? "Update" : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="admin-card rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-sub">Loading...</div>
                ) : partners.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Handshake className="h-10 w-10 text-sub/40" />
                        <p className="text-sub">No partners yet. Add your first one.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-base text-sub uppercase text-xs">
                                <tr>
                                    <th className="px-5 py-4">Name</th>
                                    <th className="px-5 py-4">Logo</th>
                                    <th className="px-5 py-4">Order</th>
                                    <th className="px-5 py-4">Status</th>
                                    <th className="px-5 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-soft text-main">
                                {partners.map((partner) => (
                                    <tr key={partner._id} className="hover:bg-base/50 transition-colors">
                                        <td className="px-5 py-3 font-medium">{partner.name}</td>
                                        <td className="px-5 py-3 text-sm text-sub">
                                            {partner.logoUrl ? (
                                                <a href={partner.logoUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                                    Preview
                                                </a>
                                            ) : (
                                                "Text only"
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-sm text-sub">{partner.sortOrder}</td>
                                        <td className="px-5 py-3">
                                            <button
                                                onClick={() => toggleActive(partner)}
                                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                                    partner.isActive ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                }`}
                                            >
                                                {partner.isActive ? "Active" : "Inactive"}
                                            </button>
                                        </td>
                                        <td className="px-5 py-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => openEdit(partner)}
                                                    className="p-2 hover:bg-base rounded-lg text-accent transition-colors"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => setPartnerToDeleteId(partner._id)}
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
            <PopupDialog
                open={Boolean(partnerToDeleteId)}
                title="Delete partner"
                message="Are you sure you want to delete this partner?"
                tone="danger"
                confirmText="Delete"
                cancelText="Cancel"
                onClose={() => setPartnerToDeleteId(null)}
                onConfirm={() => {
                    if (!partnerToDeleteId) return;
                    const id = partnerToDeleteId;
                    setPartnerToDeleteId(null);
                    void handleDelete(id);
                }}
            />
        </div>
    );
}
