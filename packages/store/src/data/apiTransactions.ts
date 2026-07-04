import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminTransaction {
    id: string;
    transaction_ref: string;
    module: "wellness" | "cafe" | string;
    reference_id: string | null;
    amount: string;
    payment_method: string;
    payment_status: "confirmed" | "pending" | "failed" | "cancelled" | string;
    created_at: string;
    confirmed_at: string | null;
    user: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string;
    } | null;
}

export interface AdminTransactionFilters {
    from?: string;
    to?: string;
    module?: string;
    status?: string;
    search?: string;
    per_page?: number;
    page?: number;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAdminTransactions(filters: AdminTransactionFilters = {}) {
    return useQuery({
        queryKey: ["admin", "transactions", filters],
        queryFn: () => {
            const params = new URLSearchParams();
            if (filters.from)     params.set("from", filters.from);
            if (filters.to)       params.set("to", filters.to);
            if (filters.module)   params.set("module", filters.module);
            if (filters.status)   params.set("status", filters.status);
            if (filters.search)   params.set("search", filters.search);
            if (filters.per_page) params.set("per_page", String(filters.per_page));
            if (filters.page)     params.set("page", String(filters.page));
            const qs = params.toString();
            return api.get<{ data: AdminTransaction[]; total: number; page: number; pages: number }>(
                `/admin/payments${qs ? `?${qs}` : ""}`
            );
        },
        staleTime: 30 * 1000,
    });
}
