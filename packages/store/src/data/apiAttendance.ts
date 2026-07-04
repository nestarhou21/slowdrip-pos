import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export interface AdminAttendanceRecord {
    id: string;
    date: string;
    clock_in_at: string;
    clock_out_at: string | null;
    hours_worked: string | null;
    clock_in_ip: string | null;
    clock_out_ip: string | null;
    status: "open" | "closed";
    notes: string | null;
    instructor: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string;
    };
}

export interface AttendanceSummaryItem {
    id: string;
    name: string;
    email: string;
    total_hours: number;
    days_worked: number;
}

export interface AttendanceFilters {
    from?: string;
    to?: string;
    instructor_id?: string;
    per_page?: number;
    page?: number;
}

export interface AttendancePagination {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

function buildQuery(filters: AttendanceFilters): string {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.instructor_id) params.set("instructor_id", filters.instructor_id);
    if (filters.per_page) params.set("per_page", String(filters.per_page));
    if (filters.page) params.set("page", String(filters.page));
    const q = params.toString();
    return q ? `?${q}` : "";
}

export const attendanceQueryKeys = {
    list: (f: AttendanceFilters) => ["admin-attendance", f] as const,
    summary: (from: string, to: string) => ["admin-attendance-summary", from, to] as const,
};

export function useAdminAttendance(filters: AttendanceFilters = {}) {
    return useQuery({
        queryKey: attendanceQueryKeys.list(filters),
        queryFn: () =>
            api.get<{ data: AdminAttendanceRecord[]; meta: AttendancePagination }>(
                `/admin/attendance${buildQuery(filters)}`
            ),
        staleTime: 30 * 1000,
    });
}

export function useAttendanceSummary(from: string, to: string) {
    return useQuery({
        queryKey: attendanceQueryKeys.summary(from, to),
        queryFn: () =>
            api.get<{ data: AttendanceSummaryItem[] }>(
                `/admin/attendance/summary?from=${from}&to=${to}`
            ),
        staleTime: 30 * 1000,
    });
}
