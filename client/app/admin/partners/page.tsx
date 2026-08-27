"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Check, Handshake } from "lucide-react";
import api from "@/lib/api";
import PopupDialog from "@/components/PopupDialog";
import PageHeader from "@/components/admin/PageHeader";
import Toggle from "@/components/admin/Toggle";
import StatusBadge from "@/components/admin/StatusBadge";
import ImageDropzone from "@/components/admin/ImageDropzone";

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

    const handleUpload = async (file: File) => {
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
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <PageHeader
                title="Partners"
                subtitle="Manage brands shown in the home page partnership strip."
                action={
                    <button
                        onClick={openCreate}
                        className="flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium w-full sm:w-auto"
                    >
                        <Plus className="h-4 w-4" />
                        Add Partner
                    </button>
                }
            />

            {error && !showForm && (
                <div className="mb-6 rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">{error}</div>
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
                                <div className="rounded-lg bg-danger/10 border border-danger/30 px-3 py-2 text-sm text-danger">{error}</div>
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

                            <ImageDropzone
                                label="Partner Logo"
                                value={form.logoUrl}
                                onUploadFile={handleUpload}
                                onUrlChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                                onClear={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                                uploading={uploading}
                                previewAspect="contain"
                                height="h-28"
                                uploadHint="Click to upload logo"
                            />

                            <div>
                                <label className="block text-xs font-medium text-sub mb-1.5 uppercase tracking-wider">Sort Order</label>
                                <input
                                    type="number"
                                    value={form.sortOrder}
                                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                                    className="w-full bg-base border border-border-soft rounded-lg px-3 py-2 text-main placeholder:text-sub focus:outline-none focus:border-accent"
                                />
                            </div>

                            <Toggle
                                layout="inline"
                                checked={form.isActive}
                                onChange={(next) => setForm((f) => ({ ...f, isActive: next }))}
                                label="Active"
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
                                            <button onClick={() => toggleActive(partner)}>
                                                <StatusBadge tone={partner.isActive ? "success" : "neutral"}>
                                                    {partner.isActive ? "Active" : "Inactive"}
                                                </StatusBadge>
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
