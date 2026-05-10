import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export interface HomeSettings {
    showDiscountedProductsRow: boolean;
}

const DEFAULT_HOME_SETTINGS: HomeSettings = {
    showDiscountedProductsRow: true,
};

export const HOME_SETTINGS_QUERY_KEY = ["home-settings"] as const;

export function getHomeSettingsQueryOptions() {
    return {
        queryKey: HOME_SETTINGS_QUERY_KEY,
        queryFn: async (): Promise<HomeSettings> => {
            try {
                const res = await api.get<HomeSettings>("/home-settings");
                return {
                    ...DEFAULT_HOME_SETTINGS,
                    ...(res.data ?? {}),
                };
            } catch {
                return DEFAULT_HOME_SETTINGS;
            }
        },
        staleTime: 20 * 60 * 1000, // 20 minutes — rarely changes; ISR ensures freshness
    };
}

export function useHomeSettings() {
    return useQuery(getHomeSettingsQueryOptions());
}
