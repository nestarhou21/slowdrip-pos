import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AdminNotificationType = "order" | "system" | "package_purchase" | "booking" | "booking_cancelled" | "booking_rescheduled";

export interface AdminNotification {
    id: string;
    type: AdminNotificationType;
    title: string;
    message: string;
    read: boolean;
    data: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const adminNotificationQueryKeys = {
    all: ["admin-notifications"] as const,
    list: (type?: string) =>
        [...adminNotificationQueryKeys.all, { type }] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useAdminNotifications(type?: AdminNotificationType, options?: any) {
    const qs = type ? `?type=${type}` : "";
    return useQuery({
        queryKey: adminNotificationQueryKeys.list(type),
        queryFn: () =>
            api
                .get<{ data: AdminNotification[] }>(`/admin/notifications${qs}`)
                .then((r) => r.data),
        staleTime: 30 * 1000,
        refetchInterval: 30 * 1000,
        ...(options ?? {}),
    });
}

export function useMarkAdminNotificationRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api
                .put<{ data: AdminNotification }>(
                    `/admin/notifications/${id}/read`
                )
                .then((r) => r.data),
        onMutate: async (id: string) => {
            await qc.cancelQueries({ queryKey: adminNotificationQueryKeys.all });
            const previous = qc.getQueriesData<AdminNotification[]>({
                queryKey: adminNotificationQueryKeys.all,
            });
            previous.forEach(([key, old]) => {
                if (!old) return;
                qc.setQueryData<AdminNotification[]>(key, old.map((n) =>
                    n.id === id ? { ...n, read: true } : n
                ));
            });
            return { previous };
        },
        onError: (_err, _id, context) => {
            context?.previous.forEach(([key, old]) => {
                if (old) qc.setQueryData(key, old);
            });
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: adminNotificationQueryKeys.all });
        },
    });
}

export function useMarkAllAdminNotificationsRead() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () =>
            api
                .put<{ message: string }>("/admin/notifications/read-all")
                .then((r) => r),
        onMutate: async () => {
            await qc.cancelQueries({ queryKey: adminNotificationQueryKeys.all });
            const previous = qc.getQueriesData<AdminNotification[]>({
                queryKey: adminNotificationQueryKeys.all,
            });
            previous.forEach(([key, old]) => {
                if (!old) return;
                qc.setQueryData<AdminNotification[]>(key, old.map((n) => ({ ...n, read: true })));
            });
            return { previous };
        },
        onError: (_err, _vars, context) => {
            context?.previous.forEach(([key, old]) => {
                if (old) qc.setQueryData(key, old);
            });
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: adminNotificationQueryKeys.all });
        },
    });
}

export function useDeleteAdminNotification() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api
                .delete<{ message: string }>(`/admin/notifications/${id}`)
                .then((r) => r),
        onSuccess: () =>
            qc.invalidateQueries({ queryKey: adminNotificationQueryKeys.all }),
    });
}

export function useSendAdminNotificationEmail() {
    return useMutation({
        mutationFn: ({
            notificationId,
            subject,
            message,
            to_email,
        }: {
            notificationId: string;
            subject: string;
            message: string;
            to_email?: string;
        }) =>
            api.post<{ message: string }>(`/admin/notifications/${notificationId}/email`, {
                subject,
                message,
                to_email,
            }),
    });
}
