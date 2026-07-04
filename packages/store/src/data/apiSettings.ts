import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessSettings {
    id: number;
    cafe_name: string;
    cafe_tagline: string | null;
    address_line1: string | null;
    address_line2: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    wifi_name: string | null;
    wifi_password: string | null;
    receipt_footer: string | null;
    logo_url: string | null;
    currency: string;
    tax_rate: number;
    tax_inclusive: boolean;
    khr_rate: number;
    studio_hours: { day: string; hours: string }[] | null;
    created_at: string;
    updated_at: string;
}

export type UpdateSettingsInput = Partial<Omit<BusinessSettings, "id" | "created_at" | "updated_at">>;

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const settingsQueryKeys = {
    all: ["settings"] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch the singleton business settings.
 */
export function useSettings(options?: any) {
    return useQuery<BusinessSettings>({        queryKey: settingsQueryKeys.all,
        queryFn: () => api.get<BusinessSettings>("/admin/settings"),
        staleTime: 5 * 60 * 1000, // 5 min
    });
}

/**
 * Update business settings (partial update).
 */
export function useUpdateSettings() {
    const queryClient = useQueryClient();
    return useMutation<BusinessSettings, Error, UpdateSettingsInput>({
        mutationFn: (data) =>
            api.put<BusinessSettings>("/admin/settings", data),
        onSuccess: (updated) => {
            queryClient.setQueryData(settingsQueryKeys.all, updated);
        },
    });
}
