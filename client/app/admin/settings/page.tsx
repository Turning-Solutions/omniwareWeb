"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { getHomeSettingsQueryOptions, HOME_SETTINGS_QUERY_KEY } from "@/lib/homeSettingsQuery";

export default function AdminSettingsPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery(getHomeSettingsQueryOptions());
    const [showDiscountedProductsRow, setShowDiscountedProductsRow] = useState(true);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        if (typeof data?.showDiscountedProductsRow === "boolean") {
            setShowDiscountedProductsRow(data.showDiscountedProductsRow);
        }
    }, [data?.showDiscountedProductsRow]);

    const mutation = useMutation({
        mutationFn: async (nextValue: boolean) => {
            const res = await api.put("/home-settings", { showDiscountedProductsRow: nextValue });
            return res.data as { showDiscountedProductsRow: boolean };
        },
        onSuccess: (next) => {
            queryClient.setQueryData(HOME_SETTINGS_QUERY_KEY, next);
            setNotice("Saved successfully.");
        },
        onError: () => {
            setNotice("Failed to save settings.");
        },
    });

    return (
        <div className="p-6 lg:p-8">
            <h1 className="mb-2 text-2xl font-bold text-main">Settings</h1>
            <p className="mb-6 text-sub">Control homepage section visibility.</p>

            <div className="max-w-xl rounded-xl border border-line bg-[#141414] p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-base font-semibold text-main">Discounted Products Row</h2>
                        <p className="mt-1 text-sm text-sub">
                            Show or hide the discounted products row on the home page.
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={isLoading || mutation.isPending}
                        onClick={() => setShowDiscountedProductsRow((prev) => !prev)}
                        className={`relative h-6 w-11 rounded-full transition-colors ${showDiscountedProductsRow ? "bg-accent" : "bg-[#3a3a3a]"}`}
                        aria-label="Toggle discounted products row visibility"
                    >
                        <span
                            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showDiscountedProductsRow ? "translate-x-5" : "translate-x-0"}`}
                        />
                    </button>
                </div>

                <div className="mt-5 flex items-center gap-3">
                    <button
                        type="button"
                        disabled={isLoading || mutation.isPending}
                        onClick={() => mutation.mutate(showDiscountedProductsRow)}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {mutation.isPending ? "Saving..." : "Save"}
                    </button>
                    {notice ? <span className="text-sm text-sub">{notice}</span> : null}
                </div>
            </div>
        </div>
    );
}
