import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterCashEntry {
    id: number;
    register_session_id: number;
    type: "in" | "out";
    amount: number;
    currency: string;
    original_amount: number | null;
    exchange_rate: number | null;
    reason: string | null;
    created_at: string;
    updated_at: string;
}

export interface RegisterSession {
    id: number;
    staff_name: string;
    shift_type: "morning" | "afternoon";
    shift_start_time: string;
    shift_end_time: string;
    opening_balance: number;
    closing_balance: number | null;
    cash_in: number;
    cash_out: number;
    cash_sales: number;
    digital_sales: number;
    status: "open" | "closed";
    opened_at: string;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
    cash_entries: RegisterCashEntry[];
}

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const registerQueryKeys = {
    all:     ["register"] as const,
    current: () => [...registerQueryKeys.all, "current"] as const,
    list:    () => [...registerQueryKeys.all, "list"] as const,
};

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Fetch the currently open register session (or null if none is open).
 * Polls every 30 seconds so the UI stays current across tabs.
 */
export function useCurrentRegisterSession(options?: any) {
    return useQuery({
        queryKey: registerQueryKeys.current(),
        queryFn:  () =>
            api.get<{ data: RegisterSession | null }>("/pos/register/current")
               .then((r) => r.data),
        refetchInterval: 30_000,
        staleTime:       10_000,
        ...(options ?? {}),
    });
}

/** Open a new register session. */
export function useOpenRegister() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: {
            staff_name:       string;
            shift_type:       "morning" | "afternoon";
            shift_start_time: string;
            shift_end_time:   string;
            opening_balance:  number;
        }) => api.post<{ data: RegisterSession }>("/pos/register/open", data).then((r) => r.data),
        onSuccess: () => qc.refetchQueries({ queryKey: registerQueryKeys.all }),
    });
}

/** Close an open session with the actual cash count. */
export function useCloseRegister() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            sessionId,
            closingBalance,
        }: {
            sessionId:      number;
            closingBalance: number;
        }) =>
            api
                .post<{ data: RegisterSession }>(
                    `/pos/register/${sessionId}/close`,
                    { closing_balance: closingBalance }
                )
                .then((r) => r.data),
        onSuccess: () => qc.refetchQueries({ queryKey: registerQueryKeys.all }),
    });
}

/** Paginated list of all sessions, newest first — for the history view. */
export function useRegisterSessions(page = 1, dateFrom?: string, dateTo?: string) {
    const params = new URLSearchParams({ page: String(page) });
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo)   params.set('date_to',   dateTo);
    return useQuery({
        queryKey: [...registerQueryKeys.list(), page, dateFrom, dateTo],
        queryFn:  () =>
            api.get<{
                data: RegisterSession[];
                current_page: number;
                last_page: number;
                total: number;
            }>(`/pos/register?${params}`),
        staleTime: 30_000,
    });
}

/** Add a manual cash-in or cash-out entry to an open session. */
export function useAddRegisterCash() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            sessionId,
            type,
            amount,
            currency,
            original_amount,
            exchange_rate,
            reason,
        }: {
            sessionId: number;
            type:      "in" | "out";
            amount:    number;
            currency?: string;
            original_amount?: number;
            exchange_rate?: number;
            reason?:   string;
        }) =>
            api
                .post<{ data: RegisterSession }>(
                    `/pos/register/${sessionId}/cash`,
                    { type, amount, currency, original_amount, exchange_rate, reason }
                )
                .then((r) => r.data),
        onSuccess: () => qc.refetchQueries({ queryKey: registerQueryKeys.current() }),
    });
}

/** Delete a manual cash entry (Admin only). */
export function useDeleteRegisterCash() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => api.delete<{ message: string }>(`/pos/register/cash/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: registerQueryKeys.all });
            qc.invalidateQueries({ queryKey: ["pos-orders"] }); // Just in case, though usually independent
        },
    });
}
