"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { getHomeSettingsQueryOptions, HOME_SETTINGS_QUERY_KEY } from "@/lib/homeSettingsQuery";
import PageHeader from "@/components/admin/PageHeader";
import Toggle from "@/components/admin/Toggle";

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
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
            <PageHeader title="Settings" subtitle="Control homepage section visibility." />

            <div className="admin-card max-w-xl rounded-xl p-5">
                <Toggle
                    checked={showDiscountedProductsRow}
                    onChange={setShowDiscountedProductsRow}
                    disabled={isLoading || mutation.isPending}
                    label="Discounted Products Row"
                    description="Show or hide the discounted products row on the home page."
                />

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
