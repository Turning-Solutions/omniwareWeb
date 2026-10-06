"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, KeyRound, Save } from "lucide-react";
import api from "@/lib/api";
import StatusBadge from "@/components/admin/StatusBadge";
import type { ActiveAi } from "./types";

interface ProviderInfo {
    id: string;
    label: string;
    configured: boolean;
    keyEnv: string;
    keyUrl: string;
    defaultModel: string;
    models: string[];
    note: string;
    chunkSize: number;
}

/** Pick the AI provider and model. API keys stay in server environment variables — only whether one is set is shown. */
export default function AiModelSettings({ active, onChanged }: { active: ActiveAi | null; onChanged: (ai: ActiveAi) => void }) {
    const [open, setOpen] = useState(false);
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [provider, setProvider] = useState(active?.providerId ?? "gemini");
    const [model, setModel] = useState(active?.model ?? "");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open || providers.length) return;
        api.get("/admin/attribute-normalization/ai-settings")
            .then(({ data }) => setProviders(data.providers ?? []))
            .catch(() => setError("Could not load the provider list."));
    }, [open, providers.length]);

    useEffect(() => {
        if (active) {
            setProvider(active.providerId);
            setModel(active.model);
        }
    }, [active]);

    const current = providers.find((p) => p.id === provider);

    const changeProvider = (id: string) => {
        setProvider(id);
        setSaved(false);
        const next = providers.find((p) => p.id === id);
        // Keep the typed model only if it's still the active provider's model; otherwise offer the new default.
        setModel(id === active?.providerId ? active.model : (next?.defaultModel ?? ""));
    };

    const save = async () => {
        setSaving(true);
        setError("");
        setSaved(false);
        try {
            const { data } = await api.put("/admin/attribute-normalization/ai-settings", { provider, model: model.trim() });
            onChanged(data.active);
            setSaved(true);
        } catch (err) {
            const e = err as { response?: { data?: { message?: string } } };
            setError(e?.response?.data?.message || "Saving failed.");
        } finally {
            setSaving(false);
        }
    };

    const dirty = active ? provider !== active.providerId || model.trim() !== active.model : true;

    return (
        <div className="admin-card rounded-xl p-6">
            <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
                <span className="flex items-center gap-2 text-base font-bold text-main">
                    <Bot className="h-5 w-5 text-accent" /> AI model
                    {active && (
                        <span className="text-sm font-normal text-sub">
                            {active.providerLabel} · {active.model || "no model chosen"}
                        </span>
                    )}
                </span>
                {active && (
                    <StatusBadge tone={active.configured ? "success" : "danger"}>
                        {active.configured ? "Key set" : "Key missing"}
                    </StatusBadge>
                )}
            </button>

            {open && (
                <div className="mt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs text-sub">
                            Provider
                            <select
                                value={provider}
                                onChange={(e) => changeProvider(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm text-main [&>option]:text-white"
                            >
                                {providers.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.label} {p.configured ? "✓" : "(key missing)"}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="block text-xs text-sub">
                            Model
                            <input
                                value={model}
                                onChange={(e) => {
                                    setModel(e.target.value);
                                    setSaved(false);
                                }}
                                list="ai-model-suggestions"
                                placeholder="Type or pick a model name"
                                className="mt-1 w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm text-main"
                            />
                            <datalist id="ai-model-suggestions">
                                {(current?.models ?? []).map((m) => (
                                    <option key={m} value={m} />
                                ))}
                            </datalist>
                        </label>
                    </div>

                    {current && (
                        <div className="rounded-lg border border-border-soft bg-panel p-3 text-xs text-sub">
                            <p>{current.note}</p>
                            <p className="mt-2 flex flex-wrap items-center gap-1.5">
                                <KeyRound className="h-3.5 w-3.5" />
                                {current.configured ? (
                                    <span className="text-success">
                                        {current.keyEnv} is set on the server.
                                    </span>
                                ) : (
                                    <span className="text-warning">
                                        Add <code>{current.keyEnv}</code> to the server environment variables (Vercel → Settings → Environment
                                        Variables) and redeploy.
                                        {current.keyUrl && (
                                            <>
                                                {" "}
                                                Get a key at{" "}
                                                <a href={current.keyUrl} target="_blank" rel="noreferrer" className="underline">
                                                    {current.keyUrl.replace(/^https?:\/\//, "")}
                                                </a>
                                                .
                                            </>
                                        )}
                                    </span>
                                )}
                            </p>
                            <p className="mt-1">Keys are never shown or stored here. About {current.chunkSize} attribute names are sent per request.</p>
                        </div>
                    )}

                    {error && <p className="text-sm text-danger">{error}</p>}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving || !model.trim() || !dirty}
                            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                        >
                            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Use this model"}
                        </button>
                        {saved && (
                            <span className="flex items-center gap-1 text-sm text-success">
                                <CheckCircle2 className="h-4 w-4" /> Saved — the next generation uses it.
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
