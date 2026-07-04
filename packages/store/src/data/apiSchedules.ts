import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../api";
import type { ApiServiceType } from "./apiWellnessServiceTypes";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiInstructor {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
}


export interface ApiBooking {
    id: string;
    userId: string | null;
    userPackageId: string | null;
    scheduleId: string;
    serviceTypeId?: string;
    className?: string;
    bookingReference: string;
    status: "confirmed" | "cancelled" | "attended" | "no_show";
    bookedAt: string;
    cancelledAt: string | null;
    cancellationReason: string | null;
    canRescheduleUntil: string | null;
    isAdminBlock?: boolean;
    adminBlockReason?: string | null;
    user?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        phone: string | null;
    };
    schedule?: ApiSchedule;
    userPackage?: ApiUserPackage;
}

export interface ApiWaitlistEntry {
    id: string;
    scheduleId: string;
    userId: string;
    userPackageId: string | null;
    status: "waiting" | "promoted" | "removed" | "expired";
    position: number;
    joinedAt: string;
    promotedAt: string | null;
    expiresAt: string | null;
    removedAt: string | null;
    removedReason: string | null;
    promotedBookingId: string | null;
    user?: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
    };
}

export interface ApiSchedule {
    id: string;
    serviceTypeId: string;
    instructorId: string | null;
    classDate: string;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    bookedCount: number;
    status: "available" | "almost_full" | "full" | "cancelled" | "completed";
    almostFullThreshold: number;
    locationNote: string | null;
    sessionTitle: string | null;
    createdAt: string;
    classType?: ApiServiceType;
    instructor?: ApiInstructor | null;
    bookings?: ApiBooking[];
}

export interface ApiScheduleDetail extends ApiSchedule {
    bookings: ApiBooking[];
}

import type { ApiUserPackage } from "./apiUserPackages";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const scheduleQueryKeys = {
    all: ["wellness-schedules"] as const,
    list: (filters?: { service_type_id?: string; date?: string; from_date?: string }) =>
        [...scheduleQueryKeys.all, filters ?? {}] as const,
    detail: (id: string) => [...scheduleQueryKeys.all, "detail", id] as const,
    adminBookings: (filters?: { date?: string; search?: string; status?: string; schedule_id?: string }) =>
        [...scheduleQueryKeys.all, "admin-bookings", filters ?? {}] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useApiAdminBookings(filters?: { date?: string; search?: string; status?: string; schedule_id?: string }, options?: any) {
    return useQuery({
        queryKey: scheduleQueryKeys.adminBookings(filters),
        queryFn: () => {
            const params = new URLSearchParams();
            if (filters?.schedule_id) params.set("schedule_id", filters.schedule_id);
            else if (filters?.date) params.set("date", filters.date);
            if (filters?.search) params.set("search", filters.search);
            if (filters?.status) params.set("status", filters.status);
            const qs = params.toString();
            const url = qs ? `/admin/wellness/bookings?${qs}` : "/admin/wellness/bookings";
            return api.get<{ data: ApiBooking[] }>(url).then((r) => r.data);
        },
        staleTime: 15 * 1000,
        ...(options ?? {}),
    });
}

export function useApiAdminUserPackages(userId: string | null) {
    return useQuery({
        queryKey: ["admin-user-packages", userId],
        queryFn: () =>
            api.get<{ data: ApiUserPackage[] }>(`/admin/wellness/users/${userId}/packages`).then((r) => r.data),
        enabled: !!userId,
    });
}

export function useApiAdminBookingPackages(bookings: ApiBooking[]) {
    const userIds = [...new Set(bookings.map((b) => b.userId).filter((id): id is string => !!id))];
    return useQuery({
        queryKey: ["admin-booking-packages", ...userIds.slice().sort()],
        queryFn: async () => {
            const results = await Promise.all(
                userIds.map((uid) =>
                    api.get<{ data: ApiUserPackage[] }>(`/admin/wellness/users/${uid}/packages`)
                        .then((r) => ({ uid, packages: r.data }))
                )
            );
            const map: Record<string, ApiUserPackage[]> = {};
            results.forEach(({ uid, packages }) => { map[uid] = packages; });
            return map;
        },
        enabled: userIds.length > 0,
        staleTime: 30 * 1000,
    });
}

export interface AdminBookCustomerBody {
    userId: string;
    scheduleId: string;
    userPackageId: string;
    force?: boolean;
    group_size?: number;
}

export function useAdminBookCustomer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AdminBookCustomerBody) =>
            api.post<{ data: ApiBooking }>("/admin/wellness/bookings", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.all });
            qc.invalidateQueries({ queryKey: ["admin-user-packages"] });
        },
    });
}

export function useAdminBlockSlots() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ scheduleId, reason, spots }: { scheduleId: string; reason: string; spots: number }) =>
            api.post<{ message: string; data: ApiBooking[] }>(`/admin/wellness/schedules/${scheduleId}/block`, { reason, spots }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.all });
        },
    });
}

export function useApiSchedules(filters?: { service_type_id?: string; date?: string; from_date?: string }, options?: any) {
    return useQuery({
        queryKey: scheduleQueryKeys.list(filters),
        queryFn: () => {
            const params = new URLSearchParams();
            if (filters?.service_type_id) params.set("service_type_id", filters.service_type_id);
            if (filters?.date) params.set("date", filters.date);
            if (filters?.from_date) params.set("from_date", filters.from_date);
            const qs = params.toString();
            const url = qs ? `/admin/wellness/schedules?${qs}` : "/admin/wellness/schedules";
            return api.get<{ data: ApiSchedule[] }>(url).then((r) => r.data);
        },
        staleTime: 30 * 1000,
        ...(options ?? {}),
    });
}

export function useApiInstructors(options?: any) {
    return useQuery({
        queryKey: ["wellness-instructors"],
        queryFn: () =>
            api.get<{ data: any[] }>("/admin/wellness/instructors").then((r) =>
                r.data.map((i): ApiInstructor => ({
                    id: i.id,
                    firstName: i.firstName ?? i.first_name ?? null,
                    lastName: i.lastName ?? i.last_name ?? null,
                    email: i.email,
                }))
            ),
        staleTime: 5 * 60 * 1000, // 5 minutes
        ...(options ?? {}),
    });
}

export function useApiScheduleDetail(id: string | null) {
    return useQuery({
        queryKey: scheduleQueryKeys.detail(id ?? ""),
        queryFn: () =>
            api.get<{ data: ApiScheduleDetail; remainingSpots: number }>(`/admin/wellness/schedules/${id}`).then((r) => ({
                schedule: r.data,
                remainingSpots: r.remainingSpots,
            })),
        enabled: !!id,
        staleTime: 30 * 1000,
    });
}

export interface CreateScheduleBody {
    serviceTypeId: string;
    instructorId?: string | null;
    classDate: string;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    almostFullThreshold?: number;
    locationNote?: string;
    sessionTitle?: string;
}

export function useCreateSchedule() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateScheduleBody) =>
            api.post<{ data: ApiSchedule }>("/admin/wellness/schedules", body),
        onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
    });
}

export interface UpdateScheduleBody {
    serviceTypeId?: string;
    instructorId?: string | null;
    classDate?: string;
    startTime?: string;
    endTime?: string;
    maxCapacity?: number;
    almostFullThreshold?: number;
    locationNote?: string | null;
    sessionTitle?: string | null;
    status?: "available" | "almost_full" | "full" | "cancelled" | "completed";
}

export function useUpdateSchedule() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...body }: UpdateScheduleBody & { id: string }) =>
            api.put<{ data: ApiSchedule }>(`/admin/wellness/schedules/${id}`, body),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.all });
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.detail(vars.id) });
        },
    });
}

export function useDeleteSchedule() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/wellness/schedules/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
    });
}

export function useBulkDeleteSchedules() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ids: string[]) =>
            api.post<{ message: string; deleted_count: number; skipped_count: number }>("/admin/wellness/schedules/bulk-delete", { ids }),
        onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
    });
}

export function useUpdateBookingAttendance() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            scheduleId,
            bookingId,
            status,
        }: {
            scheduleId: string;
            bookingId: string;
            status: "attended" | "no_show";
        }) =>
            api.put<{ message: string }>(
                `/admin/wellness/schedules/${scheduleId}/bookings/${bookingId}/attendance`,
                { status }
            ),
        onMutate: async ({ scheduleId, bookingId, status }) => {
            // Cancel both caches before optimistic update
            await Promise.all([
                qc.cancelQueries({ queryKey: scheduleQueryKeys.detail(scheduleId) }),
                qc.cancelQueries({ queryKey: scheduleQueryKeys.adminBookings() }),
            ]);

            // Snapshot for rollback
            const previousDetail = qc.getQueryData<{ schedule: ApiScheduleDetail; remainingSpots: number }>(scheduleQueryKeys.detail(scheduleId));
            const previousBookings = qc.getQueryData<ApiBooking[]>(scheduleQueryKeys.adminBookings({ schedule_id: scheduleId }));

            // Optimistic update on detail cache (bookings embedded in schedule)
            qc.setQueryData<{ schedule: ApiScheduleDetail; remainingSpots: number }>(scheduleQueryKeys.detail(scheduleId), (old) => {
                if (!old) return old;
                return {
                    ...old,
                    schedule: {
                        ...old.schedule,
                        bookings: (old.schedule.bookings ?? []).map((b) =>
                            b.id === bookingId ? { ...b, status } : b
                        ),
                    },
                };
            });

            // Optimistic update on the adminBookings cache (what the dialog actually reads)
            qc.setQueryData<ApiBooking[]>(scheduleQueryKeys.adminBookings({ schedule_id: scheduleId }), (old) => {
                if (!old) return old;
                return old.map((b: ApiBooking) => b.id === bookingId ? { ...b, status } : b);
            });

            return { previousDetail, previousBookings, scheduleId };
        },
        onError: (_err, _vars, ctx) => {
            if (ctx?.previousDetail) {
                qc.setQueryData(scheduleQueryKeys.detail(ctx.scheduleId), ctx.previousDetail);
            }
            if (ctx?.previousBookings) {
                qc.setQueryData(scheduleQueryKeys.adminBookings({ schedule_id: ctx.scheduleId }), ctx.previousBookings);
            }
        },
        onSettled: (_data, _err, vars) => {
            // Invalidate both so data is fresh after the server responds
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.detail(vars.scheduleId) });
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.adminBookings() });
        },
    });
}

export function useApiWaitlist(scheduleId: string | null) {
    return useQuery({
        queryKey: [...scheduleQueryKeys.all, "waitlist", scheduleId ?? ""],
        queryFn: () =>
            api
                .get<{ data: ApiWaitlistEntry[] }>(`/admin/wellness/schedules/${scheduleId}/waitlist`)
                .then((r) => r.data),
        enabled: !!scheduleId,
        staleTime: 15 * 1000,
    });
}

export function usePromoteWaitlistEntry() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: ({ scheduleId, entryId }: { scheduleId: string; entryId: string }) =>
            api.post<{ message: string }>(`/admin/wellness/schedules/${scheduleId}/waitlist/${entryId}/promote`),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.all });
            qc.invalidateQueries({ queryKey: [...scheduleQueryKeys.all, "waitlist", vars.scheduleId] });
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.detail(vars.scheduleId) });
        },
    });
}

export function useRemoveWaitlistEntry() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: ({ scheduleId, entryId }: { scheduleId: string; entryId: string }) =>
            api.delete<{ message: string }>(`/admin/wellness/schedules/${scheduleId}/waitlist/${entryId}`),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.all });
            qc.invalidateQueries({ queryKey: [...scheduleQueryKeys.all, "waitlist", vars.scheduleId] });
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.detail(vars.scheduleId) });
        },
    });
}

export function useReorderWaitlist() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: ({ scheduleId, entryIds }: { scheduleId: string; entryIds: string[] }) =>
            api.put<{ message: string }>(`/admin/wellness/schedules/${scheduleId}/waitlist/reorder`, {
                entryIds: entryIds,
            }),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: [...scheduleQueryKeys.all, "waitlist", vars.scheduleId] });
        },
    });
}


export function useGenerateWeeklySchedule() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (opts?: { date?: string; days?: number; force?: boolean }) =>
            api.post<{ message: string }>("/admin/wellness/schedules/generate-week", opts ?? {}),
        onSuccess: () => qc.invalidateQueries({ queryKey: scheduleQueryKeys.all }),
    });
}

export function useCancelBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/wellness/bookings/${id}/cancel`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.all });
            qc.invalidateQueries({ queryKey: ["admin-user-packages"] });
        },
    });
}

export function useDeleteBooking() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/wellness/bookings/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: scheduleQueryKeys.all });
            qc.invalidateQueries({ queryKey: ["admin-user-packages"] });
        },
    });
}
