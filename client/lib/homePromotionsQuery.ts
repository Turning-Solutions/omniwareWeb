import api from "@/lib/api";

export const HOME_PROMOTIONS_QUERY_KEY = ["promotions", "active"] as const;
export const HOME_PROMOTIONS_STALE_MS = 20 * 60 * 1000;

export interface HomePromotion {
    _id: string;
    title: string;
    description: string;
    imageUrl: string;
    link: string;
    badgeText: string;
    validFrom: string;
    validTo: string;
    directRedirect?: boolean;
}

export function getHomePromotionsQueryOptions() {
    return {
        queryKey: HOME_PROMOTIONS_QUERY_KEY,
        queryFn: async (): Promise<HomePromotion[]> => {
            try {
                const res = await api.get<HomePromotion[]>("/promotions/active");
                return Array.isArray(res.data) ? res.data : [];
            } catch {
                return [];
            }
        },
        staleTime: HOME_PROMOTIONS_STALE_MS,
    };
}

