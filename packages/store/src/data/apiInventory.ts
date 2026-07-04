import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export type InventoryCategory =
    | "beans"
    | "milk"
    | "syrups"
    | "cups"
    | "equipment"
    | "other";

export interface InventoryItem {
    id: string;
    name: string;
    category: InventoryCategory;
    image_url: string | null;
    unit: string;
    starting_stock: number;
    used: number;
    current_balance: number;
    low_stock_threshold: number | null;
    is_low_stock: boolean;
    cost_per_unit: number | null;
    stock_value: number | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

type InventoryListResponse = { data: InventoryItem[] };
type InventoryItemResponse = { data: InventoryItem };

const KEY = ["inventory"] as const;

export function useInventoryItems() {
    return useQuery<InventoryItem[]>({
        queryKey: KEY,
        queryFn: async () => {
            const res = await api.get<InventoryListResponse>("/admin/inventory");
            return res.data;
        },
    });
}

export function useAddInventoryItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: {
            name: string;
            category?: InventoryCategory;
            image_url?: string | null;
            unit: string;
            starting_stock: number;
            used?: number;
            low_stock_threshold?: number | null;
            cost_per_unit?: number | null;
            notes?: string;
        }) => api.post<InventoryItemResponse>("/admin/inventory", payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    });
}

export function useUpdateInventoryItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...payload }: Partial<InventoryItem> & { id: string }) =>
            api.put<InventoryItemResponse>(`/admin/inventory/${id}`, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    });
}

export function useRestockItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, amount }: { id: string; amount: number }) =>
            api.post<InventoryItemResponse>(`/admin/inventory/${id}/restock`, { amount }),
        onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    });
}

export function useRecordUsage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, amount }: { id: string; amount: number }) =>
            api.post<InventoryItemResponse>(`/admin/inventory/${id}/usage`, { amount }),
        onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    });
}

export function useDeleteInventoryItem() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.delete(`/admin/inventory/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
    });
}
