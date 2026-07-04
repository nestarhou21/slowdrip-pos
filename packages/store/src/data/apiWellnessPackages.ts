import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ApiServiceType } from "./apiWellnessServiceTypes";
import { serviceTypeQueryKeys } from "./apiWellnessServiceTypes";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiWellnessPackage {
    id: string;
    serviceTypeId: string;
    name: string;
    packageType: "class_pack" | "membership";
    sessionsIncluded: number | null;
    price: string;
    discountPercent: number | null;
    validityDays: number;
    benefits: string[] | null;
    remarks: string | null;
    recoveryDiscountPercent: number | null;
    groupRecoveryDiscountPercent: number | null;
    freeRecoverySessions: number | null;
    isRefundable: boolean;
    isShareable: boolean;
    isTransferable: boolean;
    isActive: boolean;
    displayOrder: number | null;
    serviceType?: ApiServiceType;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const wellnessPackageQueryKeys = {
    all: ["wellness-packages"] as const,
    list: (serviceTypeId?: string) => [...wellnessPackageQueryKeys.all, { serviceTypeId }] as const,
    detail: (id: string) => [...wellnessPackageQueryKeys.all, id] as const,
    public: (serviceTypeId: string) => ["public-packages", serviceTypeId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Public customer hook for listing active packages
 */
export function useServicePackages(serviceTypeId: string = "all") {
    return useQuery({
        queryKey: wellnessPackageQueryKeys.public(serviceTypeId),
        queryFn: async () => {
            const res = await api.get<{ data: ApiWellnessPackage[] }>(`/wellness/services/${serviceTypeId}/packages`);
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

/**
 * Admin hook for package management
 */
export function useApiWellnessPackages(serviceTypeId?: string) {
    return useQuery({
        queryKey: wellnessPackageQueryKeys.list(serviceTypeId),
        queryFn: async () => {
            const url = serviceTypeId
                ? `/admin/wellness/packages?serviceTypeId=${serviceTypeId}`
                : "/admin/wellness/packages";
            const res = await api.get<{ data: ApiWellnessPackage[] }>(url);
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });
}

export function useApiWellnessPackage(id: string | null) {
    return useQuery({
        queryKey: wellnessPackageQueryKeys.detail(id ?? ""),
        queryFn: () =>
            api.get<{ data: ApiWellnessPackage }>(`/admin/wellness/packages/${id}`).then((r) => r.data),
        enabled: !!id,
    });
}

export interface CreateWellnessPackageBody {
    serviceTypeId: string;
    name: string;
    packageType: "class_pack" | "membership";
    sessionsIncluded?: number | null;
    price: number;
    discountPercent?: number | null;
    validityDays: number;
    benefits?: string[];
    remarks?: string;
    isRefundable?: boolean;
    isShareable?: boolean;
    isTransferable?: boolean;
    isActive?: boolean;
    displayOrder?: number;
    recoveryDiscountPercent?: number | null;
    groupRecoveryDiscountPercent?: number | null;
    freeRecoverySessions?: number | null;
}


const BOOL_FIELDS = ["isActive", "isRefundable", "isShareable", "isTransferable"] as const;

export function useCreateWellnessPackage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateWellnessPackageBody) =>
            api.post<{ data: ApiWellnessPackage }>("/admin/wellness/packages", body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: wellnessPackageQueryKeys.all });
            qc.invalidateQueries({ queryKey: serviceTypeQueryKeys.all });
        },
    });
}

export interface UpdateWellnessPackageBody {
    serviceTypeId?: string;
    name?: string;
    packageType?: "class_pack" | "membership";
    sessionsIncluded?: number | null;
    price?: number;
    discountPercent?: number | null;
    validityDays?: number;
    benefits?: string[] | null;
    remarks?: string | null;
    isRefundable?: boolean;
    isShareable?: boolean;
    isTransferable?: boolean;
    isActive?: boolean;
    displayOrder?: number;
    recoveryDiscountPercent?: number | null;
    groupRecoveryDiscountPercent?: number | null;
    freeRecoverySessions?: number | null;
}

export function useUpdateWellnessPackage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...body }: UpdateWellnessPackageBody & { id: string }) =>
            api.put<{ data: ApiWellnessPackage }>(`/admin/wellness/packages/${id}`, body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: wellnessPackageQueryKeys.all });
            qc.invalidateQueries({ queryKey: serviceTypeQueryKeys.all });
        },
    });
}

export function useDeleteWellnessPackage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/wellness/packages/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: wellnessPackageQueryKeys.all });
            qc.invalidateQueries({ queryKey: serviceTypeQueryKeys.all });
        },
    });
}

export function useBulkDeleteWellnessPackages() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (ids: string[]) =>
            api.post<{ message: string; deleted_count: number; skipped_count: number }>("/admin/wellness/packages/bulk-delete", { ids }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: wellnessPackageQueryKeys.all });
            qc.invalidateQueries({ queryKey: serviceTypeQueryKeys.all });
        },
    });
}
