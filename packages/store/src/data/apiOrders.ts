import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { adminNotificationQueryKeys } from "./apiNotifications";
import type { ApiProduct, ApiProductVariant } from "./apiProducts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiOrderAddon {
    id: string;
    addon_id: string;
    addon: ApiProduct;
    price: string;
}

export interface ApiOrderItem {
    id: string;
    product_id: string | null;
    product: ApiProduct | null;
    /** Name snapshot for website orders whose item didn't match a POS product */
    item_name: string | null;
    variant_id: string | null;
    variant: ApiProductVariant | null;
    quantity: number;
    unit_price: string;
    subtotal: string;
    customisation: string | null;
    addons: ApiOrderAddon[];
}

export interface ApiOrder {
    id: string;
    order_number: string;
    order_type: "dine_in" | "takeaway";
    source: "pos" | "website";
    customer_name: string | null;
    customer_phone: string | null;
    status: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
    subtotal: string;
    discount_amount: string;
    tax_amount: string;
    total_amount: string;
    payment_method: "cash" | "card" | "qr" | "bakong";
    payment_status: "pending" | "paid" | "failed";
    received_amount: string | null;
    change_amount: string | null;
    notes: string | null;
    created_at: string;
    items: ApiOrderItem[];
}

/** A cart item used in the POS menu, containing the full API product + customization */
export interface PosCartItem {
    cartKey: string;
    product: ApiProduct;
    variant: ApiProductVariant | null;
    selectedAddons: ApiProduct[];
    quantity: number;
    notes: string;
    /** variant.price (float) + sum of addon base_price — calculated client-side for display */
    unitPrice: number;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const orderQueryKeys = {
    all: ["pos-orders"] as const,
    list: (date?: string) => [...orderQueryKeys.all, { date }] as const,
    detail: (id: string) => [...orderQueryKeys.all, id] as const,
};

// ─── Place Order ─────────────────────────────────────────────────────────────

export interface BakongQrData {
    qr_string: string;
    md5: string;
    order_id: string;
    amount: number;
}

export interface PlaceOrderPayload {
    order_type: "dine_in" | "takeaway";
    payment_method: "cash" | "qr" | "bakong";
    items: {
        product_id: string;
        variant_id: string | null;
        quantity: number;
        customisation: string | null;
        addon_ids: string[];
    }[];
    discount_code?: string | null;
    discount_percent?: number | null;
    received_amount?: number | null;
    notes?: string | null;
}

export interface PlaceOrderResponse {
    data: ApiOrder;
    bakong_qr?: BakongQrData | null;
}

export function usePlaceOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: PlaceOrderPayload) =>
            api.post<PlaceOrderResponse>("/pos/orders", payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: orderQueryKeys.all });
            qc.invalidateQueries({ queryKey: adminNotificationQueryKeys.all });
        },
    });
}

export function useCheckBakongStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (orderId: string) =>
            api.get<any>(`/pos/orders/${orderId}/bakong-status`).then(r => ({
                status: (r?.status ?? r?.data?.status) as "confirmed" | "pending",
            })),
        onSuccess: (data) => {
            if (data.status === "confirmed") {
                qc.invalidateQueries({ queryKey: orderQueryKeys.all });
                qc.invalidateQueries({ queryKey: ["reports"] });
            }
        },
    });
}

export function useRegenerateBakongQr() {
    return useMutation({
        mutationFn: (orderId: string) =>
            api.post<{ bakong_qr: BakongQrData }>(`/pos/orders/${orderId}/regenerate-bakong-qr`, {}),
    });
}

export function useThermalPrint() {
    return useMutation({
        mutationFn: (orderId: string) =>
            api.post<{ message: string; configured?: boolean }>(`/pos/orders/${orderId}/thermal-print`, {}),
    });
}

// ─── Update Order Status ──────────────────────────────────────────────────────

export type ApiOrderStatus = "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";

export function useUpdateOrderStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, status }: { id: string; status: ApiOrderStatus }) =>
            api.put<{ data: ApiOrder }>(`/pos/orders/${id}/status`, { status }).then((r) => r.data),
        onMutate: async ({ id, status }) => {
            await qc.cancelQueries({ queryKey: orderQueryKeys.all });
            const listQueries = qc.getQueriesData<ApiOrder[]>({ queryKey: orderQueryKeys.all });
            listQueries.forEach(([key, old]) => {
                if (!old) return;
                qc.setQueryData(key, old.map((o) => (o.id === id ? { ...o, status } : o)));
            });
            return { listQueries };
        },
        onError: (_err, _vars, ctx) => {
            ctx?.listQueries.forEach(([key, old]) => { if (old) qc.setQueryData(key, old); });
        },
        onSettled: () => qc.invalidateQueries({ queryKey: orderQueryKeys.all }),
    });
}

// ─── Delete Order ─────────────────────────────────────────────────────────────

export function useDeleteOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => api.delete<{ message: string }>(`/pos/orders/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: orderQueryKeys.all });
            qc.invalidateQueries({ queryKey: ["register-session"] }); // Shift totals might change
        },
    });
}

// ─── List Orders ─────────────────────────────────────────────────────────────

export function useApiPosOrders(date?: string, options?: any) {
    return useQuery({
        queryKey: orderQueryKeys.list(date),
        queryFn: () =>
            api
                .get<any>(`/pos/orders${date ? `?date=${date}` : ""}`)
                .then((r) => {
                    const list: ApiOrder[] = Array.isArray(r) ? r : (r?.data ?? []);
                    return list.map(o => ({
                        ...o,
                        total_amount:    String(o.total_amount    ?? 0),
                        subtotal:        String(o.subtotal        ?? 0),
                        tax_amount:      String(o.tax_amount      ?? 0),
                        discount_amount: String(o.discount_amount ?? 0),
                        order_number:    String(o.order_number    ?? ""),
                        items:           o.items ?? [],
                    }));
                }),
        staleTime: 30 * 1000,
        ...(options ?? {}),
    });
}
