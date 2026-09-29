"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "compareProducts";
export const MAX_COMPARE_ITEMS = 5;

export interface CompareItem {
    _id: string;
    slug?: string;
    title: string;
    image?: string;
    price: number;
    /** Top-level category — every item in the list must share it. */
    categoryId: string;
    categoryName: string;
    categorySlug?: string;
}

export type AddToCompareResult =
    | { ok: true }
    | { ok: false; reason: "category_mismatch"; currentCategoryName: string }
    | { ok: false; reason: "limit" };

interface CompareContextType {
    compareItems: CompareItem[];
    isInCompare: (id: string) => boolean;
    addToCompare: (item: CompareItem) => AddToCompareResult;
    /** Clears the list and starts a new one with this item (used when switching category). */
    replaceCompare: (item: CompareItem) => void;
    removeFromCompare: (id: string) => void;
    clearCompare: () => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: React.ReactNode }) {
    const [compareItems, setCompareItems] = useState<CompareItem[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            const parsed = saved ? JSON.parse(saved) : [];
            // eslint-disable-next-line react-hooks/set-state-in-effect
            if (Array.isArray(parsed)) setCompareItems(parsed.slice(0, MAX_COMPARE_ITEMS));
        } catch {
            // ignore corrupt storage
        }
        setLoaded(true);
    }, []);

    useEffect(() => {
        if (!loaded) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(compareItems));
        } catch {
            // ignore storage failures (private mode etc.)
        }
    }, [compareItems, loaded]);

    // Keep multiple tabs in sync.
    useEffect(() => {
        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY) return;
            try {
                const parsed = e.newValue ? JSON.parse(e.newValue) : [];
                if (Array.isArray(parsed)) setCompareItems(parsed.slice(0, MAX_COMPARE_ITEMS));
            } catch {
                // ignore
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, []);

    const isInCompare = useCallback((id: string) => compareItems.some((x) => x._id === id), [compareItems]);

    const addToCompare = useCallback(
        (item: CompareItem): AddToCompareResult => {
            const current = compareItems[0];
            if (current && current.categoryId !== item.categoryId) {
                return { ok: false, reason: "category_mismatch", currentCategoryName: current.categoryName };
            }
            if (compareItems.length >= MAX_COMPARE_ITEMS && !compareItems.some((x) => x._id === item._id)) {
                return { ok: false, reason: "limit" };
            }
            setCompareItems((prev) =>
                prev.some((x) => x._id === item._id) ? prev : [...prev, item].slice(0, MAX_COMPARE_ITEMS)
            );
            return { ok: true };
        },
        [compareItems]
    );

    const replaceCompare = useCallback((item: CompareItem) => setCompareItems([item]), []);
    const removeFromCompare = useCallback(
        (id: string) => setCompareItems((prev) => prev.filter((x) => x._id !== id)),
        []
    );
    const clearCompare = useCallback(() => setCompareItems([]), []);

    const value = useMemo(
        () => ({ compareItems, isInCompare, addToCompare, replaceCompare, removeFromCompare, clearCompare }),
        [compareItems, isInCompare, addToCompare, replaceCompare, removeFromCompare, clearCompare]
    );

    return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
    const context = useContext(CompareContext);
    if (!context) throw new Error("useCompare must be used within a CompareProvider");
    return context;
}
