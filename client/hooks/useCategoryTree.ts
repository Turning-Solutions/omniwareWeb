import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export type CategoryTreeItem = {
    _id: string;
    name: string;
    slug: string;
    parentId?: string | null;
};

/** Flat list of active categories. Shares its cache key with the shop sidebar / SSR prefetch. */
export function useCategoryTree() {
    return useQuery<CategoryTreeItem[]>({
        queryKey: ["shop-category-tree"],
        queryFn: async () => {
            const { data } = await api.get("/products/categories");
            return Array.isArray(data) ? (data as CategoryTreeItem[]) : [];
        },
        staleTime: 5 * 60 * 1000,
    });
}
