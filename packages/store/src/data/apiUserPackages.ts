import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "../api";
import type { ApiWellnessPackage } from "./apiWellnessPackages";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiUserPackageUser {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
}

export type ApiUserPackageStatus = "active" | "inactive" | "not_started" | "pending" | "expired" | "exhausted" | "cancelled";

export interface ApiUserPackage {
    id: string;
    userId: string;
    packageId: string;
    purchaseDate: string;
    expiryDate: string | null;
    sessionsRemaining: number | null;
    status: ApiUserPackageStatus;
    paymentReference: string | null;
    paymentStatus: "pending" | "confirmed" | "failed";
    createdAt: string;
    updatedAt: string;
    user?: ApiUserPackageUser;
    package?: ApiWellnessPackage;
    paymentTransactions?: any[];
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const userPackageQueryKeys = {
    all: ["user-packages"] as const,
    list: (filters?: { status?: string; search?: string; page?: number }) =>
        [...userPackageQueryKeys.all, filters ?? {}] as const,
};

export interface UserPackageMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useApiUserPackages(filters?: { userId?: string; status?: string; search?: string; page?: number }, options?: any) {
    return useQuery({
        queryKey: userPackageQueryKeys.list(filters),
        queryFn: () => {
            const params = new URLSearchParams();
            if (filters?.userId) params.set("userId", filters.userId);
            if (filters?.status) params.set("status", filters.status);
            if (filters?.search) params.set("search", filters.search);
            if (filters?.page)   params.set("page", String(filters.page));
            const qs = params.toString();
            const url = qs ? `/admin/wellness/user-packages?${qs}` : "/admin/wellness/user-packages";
            return api.get<{ data: ApiUserPackage[]; meta: UserPackageMeta }>(url);
        },
        staleTime: 60 * 1000,
        placeholderData: keepPreviousData,
        ...(options ?? {}),
    });
}

export interface CreateUserPackageBody {
    userId: string;
    packageId: string;
    paymentMethod: "cash" | "qr_scan" | "card";
    paymentStatus?: "pending" | "confirmed";
    benefitSourcePackageId?: string | null;
}

export function useCreateUserPackage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateUserPackageBody) =>
            api.post<{ data: ApiUserPackage; bakong_qr?: { qr_string: string; md5: string } }>("/admin/wellness/user-packages", {
                user_id:                    body.userId,
                package_id:                 body.packageId,
                payment_method:             body.paymentMethod,
                payment_status:             body.paymentStatus ?? "confirmed",
                benefit_source_package_id:  body.benefitSourcePackageId ?? null,
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: userPackageQueryKeys.all });
            // Also invalidate the per-user admin packages query used in ManualBookingDialog
            qc.invalidateQueries({ queryKey: ["admin-user-packages"] });
        },
    });
}

export function useAdminCheckPackageBakongStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userPackageId: string) =>
            api.get<any>(`/admin/wellness/user-packages/${userPackageId}/bakong-status`).then(r => ({
                // Normalise both direct { status } and nested { data: { status } } shapes
                status: (r?.status ?? r?.data?.status) as "confirmed" | "pending",
            })),
        onSuccess: (data) => {
            if (data?.status === "confirmed") {
                qc.invalidateQueries({ queryKey: userPackageQueryKeys.all });
                qc.invalidateQueries({ queryKey: ["admin-user-packages"] });
                qc.invalidateQueries({ queryKey: ["reports"] });
            }
        },
    });
}

export interface UpdateUserPackageBody {
    sessionsRemaining?: number | null;
    expiryDate?: string | null;
    status?: "active" | "inactive" | "not_started" | "pending" | "expired" | "exhausted" | "cancelled";
    paymentStatus?: "pending" | "confirmed" | "failed";
}

export function useUpdateUserPackage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, sessionsRemaining, expiryDate, status, paymentStatus }: UpdateUserPackageBody & { id: string }) =>
            api.put<{ data: ApiUserPackage }>(`/admin/wellness/user-packages/${id}`, {
                ...(sessionsRemaining !== undefined && { sessions_remaining: sessionsRemaining }),
                ...(expiryDate        !== undefined && { expiry_date: expiryDate }),
                ...(status            !== undefined && { status }),
                ...(paymentStatus     !== undefined && { payment_status: paymentStatus }),
            }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: userPackageQueryKeys.all });
        },
    });
}

export function useUserPackageDeletePreview() {
    return useMutation({
        mutationFn: (id: string) =>
            api.get<{ active_bookings: number; package_name: string }>(
                `/admin/wellness/user-packages/${id}/delete-preview`
            ),
    });
}

export function useDeleteUserPackage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/wellness/user-packages/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: userPackageQueryKeys.all });
        },
    });
}
