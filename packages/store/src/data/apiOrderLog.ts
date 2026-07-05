import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { getAccessToken } from "../auth";

const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderLogRow {
    order_number: string;
    date: string;
    time: string;
    product: string;
    product_image: string | null;
    size: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    order_type: string;
    source: string;
    payment_method: string;
}

export interface OrderLogResponse {
    data: OrderLogRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface OrderLogHourlyBucket {
    hour: number;
    total_qty: number;
    total_revenue: number;
    order_count: number;
}

export interface OrderLogSummary {
    total_orders: number;
    dine_in: number;
    takeaway: number;
    pos: number;
    website: number;
}

export interface OrderLogFilters {
    from?: string;
    to?: string;
    page?: number;
    per_page?: number;
    order_type?: string;
    source?: string;
    [key: string]: string | number | undefined;
}

export const ORDER_LOG_COLUMNS = [
    { key: "order_number",   label: "Order #" },
    { key: "date",           label: "Date" },
    { key: "time",           label: "Time" },
    { key: "product",        label: "Product" },
    { key: "size",           label: "Size" },
    { key: "quantity",       label: "Qty" },
    { key: "unit_price",     label: "Unit Price" },
    { key: "subtotal",       label: "Subtotal" },
    { key: "order_type",     label: "Order Type" },
    { key: "source",         label: "Source" },
    { key: "payment_method", label: "Payment" },
] as const;

export type OrderLogColumnKey = (typeof ORDER_LOG_COLUMNS)[number]["key"];

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const orderLogQueryKeys = {
    list: (filters: OrderLogFilters) => ["order-log", "list", filters] as const,
    hourly: (from?: string, to?: string) => ["order-log", "hourly", { from, to }] as const,
    summary: (filters: OrderLogFilters) => ["order-log", "summary", filters] as const,
};

function buildQs(params: Record<string, unknown>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== "") p.append(k, String(v));
    }
    const s = p.toString();
    return s ? `?${s}` : "";
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useOrderLog(filters: OrderLogFilters) {
    return useQuery({
        queryKey: orderLogQueryKeys.list(filters),
        queryFn: () => api.get<OrderLogResponse>(`/admin/order-log${buildQs(filters)}`),
        staleTime: 30 * 1000,
    });
}

export function useOrderLogHourly(from?: string, to?: string) {
    return useQuery({
        queryKey: orderLogQueryKeys.hourly(from, to),
        queryFn: () =>
            api
                .get<{ data: OrderLogHourlyBucket[] }>(`/admin/order-log/hourly${buildQs({ from, to })}`)
                .then((r) => r.data),
        staleTime: 30 * 1000,
    });
}

export function useOrderLogSummary(filters: OrderLogFilters) {
    return useQuery({
        queryKey: orderLogQueryKeys.summary(filters),
        queryFn: () =>
            api
                .get<{ data: OrderLogSummary }>(`/admin/order-log/summary${buildQs(filters)}`)
                .then((r) => r.data),
        staleTime: 30 * 1000,
    });
}

/** Downloads the CSV/PDF export directly (not a query — triggers a file download). */
export async function downloadOrderLogExport(
    format: "csv" | "pdf",
    filters: OrderLogFilters,
    columns: OrderLogColumnKey[]
) {
    const token = await getAccessToken();
    const qs = buildQs({ ...filters, columns: columns.join(",") });
    const res = await fetch(`${API_BASE_URL}/admin/order-log/export/${format}${qs}`, {
        headers: { Authorization: `Bearer ${token ?? ""}`, Accept: "*/*" },
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `order-log-${new Date().toISOString().slice(0, 10)}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
}
