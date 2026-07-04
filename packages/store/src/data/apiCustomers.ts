import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiCustomerAccount {
    id: string;
    userId: string;
    joinedAt: string;
    user: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        email: string;
        phone: string | null;
        isActive: boolean;
        createdAt: string;
    };
}

export interface ApiCustomerDetail extends ApiCustomerAccount {
    user: ApiCustomerAccount["user"] & {
        wellnessBookings?: {
            id: string;
            status: string;
            bookedAt: string;
            schedule: {
                classDate: string;
                startTime: string;
                classType?: { name: string };
            };
        }[];
        waitlistEntries?: {
            id: string;
            status: string;
            joinedAt: string;
            position: number;
            schedule: {
                classDate: string;
                startTime: string;
                classType?: { name: string };
            };
        }[];
    };
}

// ─── Paginated response shape (Laravel) ──────────────────────────────────────

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const customerQueryKeys = {
    all: ["admin-customers"] as const,
    list: (page?: number, search?: string) => [...customerQueryKeys.all, { page, search }] as const,
    detail: (userId: string) => [...customerQueryKeys.all, "detail", userId] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useApiCustomers(page: number = 1, _tierId?: string, enabled: boolean = true, search?: string) {
    return useQuery({
        queryKey: customerQueryKeys.list(page, search),
        queryFn: () => {
            const params = new URLSearchParams();
            params.set("page", String(page));
            if (search) params.set("search", search);
            return api.get<PaginatedResponse<ApiCustomerAccount>>(`/admin/customers?${params.toString()}`);
        },
        staleTime: 30 * 1000,
        enabled,
    });
}

export function useApiCustomerDetail(userId: string | null) {
    return useQuery({
        queryKey: customerQueryKeys.detail(userId ?? ""),
        queryFn: () =>
            api.get<{ data: ApiCustomerDetail }>(`/admin/customers/${userId}`).then((r) => r.data),
        enabled: !!userId,
        staleTime: 30 * 1000,
    });
}

export interface RegisterCustomerInput {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    password?: string;
}

export function useRegisterCustomer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (data: RegisterCustomerInput) =>
            api.post<{ message: string }>("/admin/customers/register", {
                first_name: data.firstName,
                last_name:  data.lastName || undefined,
                email:      data.email,
                phone:      data.phone || undefined,
                password:   data.password || undefined,
            }),
        onSuccess: () => qc.invalidateQueries({ queryKey: customerQueryKeys.all }),
    });
}

export function useCustomerDeletePreview() {
    return useMutation({
        mutationFn: (userId: string) =>
            api.get<{ active_bookings: number; active_packages: number; name: string }>(
                `/admin/customers/${userId}/delete-preview`
            ),
    });
}

export function useDeleteCustomer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (userId: string) =>
            api.delete<{ message: string }>(`/admin/customers/${userId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: customerQueryKeys.all }),
    });
}
