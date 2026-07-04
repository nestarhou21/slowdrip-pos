import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiServiceType {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
    packagesCount?: number;
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const serviceTypeQueryKeys = {
    all: ["wellness-service-types"] as const,
    detail: (id: string) => [...serviceTypeQueryKeys.all, id] as const,
    public: ["public-service-types"] as const,
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Public customer hook for listing active service types
 */
export function useServiceTypes() {
    return useQuery({
        queryKey: serviceTypeQueryKeys.public,
        queryFn: () =>
            api.get<{ data: ApiServiceType[] }>("/wellness/services").then((r) => r.data),
        staleTime: 5 * 60 * 1000,
    });
}

export function useApiServiceTypes(options?: any) {
    return useQuery({
        queryKey: serviceTypeQueryKeys.all,
        queryFn: async () => {
            const res = await api.get<{ data: ApiServiceType[] }>("/admin/wellness/service-types");
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
        ...(options ?? {}),
    });
}

export function useApiServiceType(id: string | null) {
    return useQuery({
        queryKey: serviceTypeQueryKeys.detail(id ?? ""),
        queryFn: () =>
            api.get<{ data: ApiServiceType }>(`/admin/wellness/service-types/${id}`).then((r) => r.data),
        enabled: !!id,
    });
}


export function useCreateServiceType() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: { name: string; description?: string; imageUrl?: string; isActive?: boolean }) =>
            api.post<{ data: ApiServiceType }>("/admin/wellness/service-types", body),
        onSuccess: () => qc.invalidateQueries({ queryKey: serviceTypeQueryKeys.all }),
    });
}

export function useUpdateServiceType() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...body }: { id: string; name?: string; description?: string; imageUrl?: string | null; isActive?: boolean }) =>
            api.put<{ data: ApiServiceType }>(`/admin/wellness/service-types/${id}`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: serviceTypeQueryKeys.all }),
    });
}

export function useDeleteServiceType() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/wellness/service-types/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: serviceTypeQueryKeys.all }),
    });
}
