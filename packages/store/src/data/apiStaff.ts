import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export interface ApiStaffMember {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    role: "admin" | "barista" | "receptionist" | "instructor";
    is_active: boolean;
    created_at: string;
}

export const staffQueryKeys = {
    all: ["admin-staff"] as const,
};

export function useApiStaff(options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: staffQueryKeys.all,
        queryFn: () =>
            api.get<{ data: ApiStaffMember[] }>("/admin/users?role=admin,staff,barista,receptionist,instructor")
               .then((r) => r.data),
        staleTime: 60 * 1000,
        enabled: options?.enabled !== false,
    });
}

export function useDeleteStaffMember() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/users/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: staffQueryKeys.all });
        },
    });
}
