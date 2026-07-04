import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { getAccessToken } from "../auth";

const API_BASE_URL =
    (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000/api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DashboardOverview {
    total_revenue: number;
    cafe_revenue: number;
    cafe_orders: number;
    wellness_bookings: number;
    packages_sold: number;
    new_loyalty_members: number;
    points_issued: number;
}

export interface DashboardReport {
    period: { from: string; to: string };
    overview: DashboardOverview;
}

export interface ComparisonMetric {
    current: number;
    previous: number;
    change: number;
}

export interface DashboardComparison {
    current_period: { from: string; to: string };
    previous_period: { from: string; to: string };
    cafe_revenue: ComparisonMetric;
    cafe_orders: ComparisonMetric;
    wellness_bookings: ComparisonMetric;
    packages_sold: ComparisonMetric;
}

export interface CafeReportProduct {
    product_id: string;
    total_qty: number;
    total_revenue: number;
    product: { id: string; name: string } | null;
}

export interface CafeReportPaymentMethod {
    payment_method: string;
    order_count: number;
    revenue: number;
}

export interface CafeReportOrderType {
    order_type: string;
    order_count: number;
    revenue: number;
}

export interface CafeReportStatus {
    status: string;
    count: number;
}

export interface CafeReport {
    period: { from: string; to: string };
    revenue_by_payment_method: CafeReportPaymentMethod[];
    revenue_by_order_type: CafeReportOrderType[];
    top_products: CafeReportProduct[];
    least_products: CafeReportProduct[];
    orders_by_status: CafeReportStatus[];
    total_discount_given: number;
}

export interface CafeTrendPoint {
    period_key: string;
    label: string;
    orders: number;
    revenue: number;
}

export interface WellnessReportClass {
    id: string;
    service_type_id: string;
    class_date: string;
    start_time: string;
    max_capacity: number;
    booked_count: number;
    bookings_count: number;
    service_type: { id: string; name: string } | null;
}

export interface WellnessReport {
    period: { from: string; to: string };
    bookings_by_status: { status: string; count: number }[];
    popular_classes: WellnessReportClass[];
    package_revenue: number;
    cancellation_rate: string;
    total_bookings: number;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const reportQueryKeys = {
    dashboard: (from?: string, to?: string) =>
        ["reports", "dashboard", { from, to }] as const,
    comparison: (from?: string, to?: string) =>
        ["reports", "dashboard-comparison", { from, to }] as const,
    cafe: (from?: string, to?: string) =>
        ["reports", "cafe", { from, to }] as const,
    trend: (period: string, from?: string, to?: string) =>
        ["reports", "cafe-trend", { period, from, to }] as const,
    wellness: (from?: string, to?: string) =>
        ["reports", "wellness", { from, to }] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function buildQs(params: Record<string, string | undefined>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) p.append(k, v);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
}

export function useDashboardReport(from?: string, to?: string) {
    return useQuery({
        queryKey: reportQueryKeys.dashboard(from, to),
        queryFn: () =>
            api
                .get<{ data: DashboardReport }>(
                    `/admin/reports/dashboard${buildQs({ from, to })}`
                )
                .then((r) => r.data),
        staleTime: 60 * 1000,
    });
}

export function useDashboardComparison(from?: string, to?: string) {
    return useQuery({
        queryKey: reportQueryKeys.comparison(from, to),
        queryFn: () =>
            api
                .get<{ data: DashboardComparison }>(
                    `/admin/reports/dashboard/comparison${buildQs({ from, to })}`
                )
                .then((r) => r.data),
        staleTime: 60 * 1000,
    });
}

export function useCafeReport(from?: string, to?: string) {
    return useQuery({
        queryKey: reportQueryKeys.cafe(from, to),
        queryFn: () =>
            api
                .get<{ data: CafeReport }>(
                    `/admin/reports/cafe${buildQs({ from, to })}`
                )
                .then((r) => r.data),
        staleTime: 60 * 1000,
    });
}

export function useApiCafeTrend(
    period: "daily" | "monthly",
    from?: string,
    to?: string
) {
    return useQuery({
        queryKey: reportQueryKeys.trend(period, from, to),
        queryFn: () =>
            api
                .get<{ data: CafeTrendPoint[] }>(
                    `/admin/reports/cafe/trend${buildQs({ period, from, to })}`
                )
                .then((r) => r.data),
        staleTime: 60 * 1000,
    });
}

export function useWellnessReport(from?: string, to?: string) {
    return useQuery({
        queryKey: reportQueryKeys.wellness(from, to),
        queryFn: () =>
            api
                .get<{ data: WellnessReport }>(
                    `/admin/reports/wellness${buildQs({ from, to })}`
                )
                .then((r) => r.data),
        staleTime: 60 * 1000,
    });
}

// ─── Export helpers ──────────────────────────────────────────────────────────

async function downloadFile(
    endpoint: string,
    filename: string,
    accept = "text/csv"
): Promise<void> {
    const token = await getAccessToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
            Authorization: `Bearer ${token ?? ""}`,
            Accept: accept,
        },
    });
    if (!response.ok) throw new Error("Export failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// CSV exports
export async function exportCafeOrders(from: string, to: string): Promise<void> {
    const qs = new URLSearchParams({ from, to }).toString();
    await downloadFile(`/admin/export/cafe-orders?${qs}`, `cafe-orders-${from}-to-${to}.csv`);
}

export async function exportBookings(from: string, to: string): Promise<void> {
    const qs = new URLSearchParams({ from, to }).toString();
    await downloadFile(`/admin/export/bookings?${qs}`, `bookings-${from}-to-${to}.csv`);
}

export async function exportPayments(from: string, to: string): Promise<void> {
    const qs = new URLSearchParams({ from, to }).toString();
    await downloadFile(`/admin/export/payments?${qs}`, `payments-${from}-to-${to}.csv`);
}

// Excel exports
export async function exportCafeOrdersExcel(from: string, to: string): Promise<void> {
    const qs = new URLSearchParams({ from, to }).toString();
    await downloadFile(
        `/admin/export/cafe-orders/excel?${qs}`,
        `cafe-orders-${from}-to-${to}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
}

export async function exportBookingsExcel(from: string, to: string): Promise<void> {
    const qs = new URLSearchParams({ from, to }).toString();
    await downloadFile(
        `/admin/export/bookings/excel?${qs}`,
        `bookings-${from}-to-${to}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
}

export async function exportPaymentsExcel(from: string, to: string): Promise<void> {
    const qs = new URLSearchParams({ from, to }).toString();
    await downloadFile(
        `/admin/export/payments/excel?${qs}`,
        `payments-${from}-to-${to}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
}

// PDF summary
export async function exportSummaryPdf(from: string, to: string): Promise<void> {
    const qs = new URLSearchParams({ from, to }).toString();
    await downloadFile(
        `/admin/export/summary-pdf?${qs}`,
        `summary-report-${from}-to-${to}.pdf`,
        "application/pdf"
    );
}
