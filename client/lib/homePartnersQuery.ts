import { useQuery, type UseQueryOptions } from "@tanstack/react-query";

export interface PartnerBrand {
    _id?: string;
    name: string;
    logoUrl?: string;
}

export const FALLBACK_TOP_BRANDS: PartnerBrand[] = [
    { name: "AMD" },
    { name: "INTEL" },
    { name: "NVIDIA" },
    { name: "ASUS" },
    { name: "MSI" },
    { name: "GIGABYTE" },
    { name: "ZOTAG" },
    { name: "CORSAIR" },
    { name: "NZXT" },
    { name: "ANTEC" },
    { name: "PROLINK" },
    { name: "OMIKUMA" },
    { name: "WD" },
    { name: "SAMSUNG" },
];

export const HOME_PARTNERS_QUERY_KEY = ["partners", "active"] as const;
export const HOME_PARTNERS_STALE_MS = 20 * 60 * 1000;

export function getHomePartnersQueryOptions(): UseQueryOptions<PartnerBrand[], Error, PartnerBrand[], readonly ["partners", "active"]> {
    return {
        queryKey: HOME_PARTNERS_QUERY_KEY,
        queryFn: async (): Promise<PartnerBrand[]> => {
            try {
                const res = await fetch("/api/v1/partners/active");
                if (!res.ok) throw new Error("Failed to load partners");
                const data = (await res.json()) as unknown;
                return Array.isArray(data) ? (data as PartnerBrand[]) : [];
            } catch {
                return FALLBACK_TOP_BRANDS;
            }
        },
        staleTime: HOME_PARTNERS_STALE_MS,
    };
}

export function useHomePartners() {
    return useQuery(getHomePartnersQueryOptions());
}

