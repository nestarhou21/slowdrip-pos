import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ApiCategory {
    id: string;
    name: string;
    is_active: boolean;
    products_count?: number;
}

export interface CafeSize {
    id: string;
    name: string;
    sort_order: number;
}

export interface ApiProductVariant {
    id: string;
    size_id: string;
    size: CafeSize;
    price: string;
    is_available: boolean;
}

export interface ApiProduct {
    id: string;
    category_id: string;
    type: 'drink' | 'snack' | 'addon';
    name: string;
    description: string | null;
    image_url: string | null;
    is_available: boolean;
    show_on_website: boolean;
    has_variants: boolean;
    base_price: string;
    category: ApiCategory;
    variants: ApiProductVariant[];
    linked_addons: ApiProduct[];
}

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const productQueryKeys = {
    all: ["cafe-products"] as const,
    list: (categoryId?: string) => [...productQueryKeys.all, { categoryId }] as const,
    detail: (id: string) => [...productQueryKeys.all, id] as const,
};

export const categoryQueryKeys = {
    all: ["cafe-categories"] as const,
};

export const sizeQueryKeys = {
    all: ["cafe-sizes"] as const,
};

// ─── Category Hooks ──────────────────────────────────────────────────────────

export function useApiCategories(options?: any) {
    return useQuery({
        queryKey: categoryQueryKeys.all,
        queryFn: () =>
            api.get<{ data: ApiCategory[] }>("/admin/cafe/categories").then((r) => r.data),
        staleTime: 5 * 60 * 1000,
        ...(options ?? {}),
    });
}

export function useCreateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: { name: string; is_active?: boolean }) =>
            api.post<{ data: ApiCategory }>("/admin/cafe/categories", body),
        onSuccess: () => qc.invalidateQueries({ queryKey: categoryQueryKeys.all }),
    });
}

export function useUpdateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...body }: { id: string; name?: string; is_active?: boolean }) =>
            api.put<{ data: ApiCategory }>(`/admin/cafe/categories/${id}`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: categoryQueryKeys.all }),
    });
}

export function useDeleteCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/cafe/categories/${id}`),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: categoryQueryKeys.all });
            qc.invalidateQueries({ queryKey: productQueryKeys.all });
        },
    });
}

// ─── Product Hooks ───────────────────────────────────────────────────────────

export function useApiProducts(categoryId?: string, options?: any) {
    return useQuery({
        queryKey: productQueryKeys.list(categoryId),
        queryFn: () => {
            const url = categoryId
                ? `/admin/cafe/products?category_id=${categoryId}`
                : "/admin/cafe/products";
            return api.get<{ data: ApiProduct[] }>(url).then((r) => r.data);
        },
        staleTime: 30 * 1000,
        ...(options ?? {}),
    });
}

export function useApiProduct(id: string | null) {
    return useQuery({
        queryKey: productQueryKeys.detail(id ?? ""),
        queryFn: () => api.get<{ data: ApiProduct }>(`/admin/cafe/products/${id}`).then((r) => r.data),
        enabled: !!id,
        staleTime: 30 * 1000,
    });
}

export interface CreateProductBody {
    category_id: string;
    type?: 'drink' | 'snack' | 'addon';
    name: string;
    description?: string;
    image_url?: string;
    base_price: number;
    is_available?: boolean;
    show_on_website?: boolean;
    has_variants?: boolean;
}

export function useCreateProduct() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateProductBody) =>
            api.post<{ data: ApiProduct }>("/admin/cafe/products", body),
        onSuccess: () => qc.invalidateQueries({ queryKey: productQueryKeys.all }),
    });
}

export interface UpdateProductBody {
    category_id?: string;
    type?: 'drink' | 'snack' | 'addon';
    name?: string;
    description?: string | null;
    image_url?: string | null;
    base_price?: number;
    is_available?: boolean;
    show_on_website?: boolean;
    has_variants?: boolean;
}

export function useUpdateProduct() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...body }: UpdateProductBody & { id: string }) =>
            api.put<{ data: ApiProduct }>(`/admin/cafe/products/${id}`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: productQueryKeys.all }),
    });
}

export function useDeleteProduct() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/cafe/products/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: productQueryKeys.all }),
    });
}

// ─── Variant Hooks ────────────────────────────────────────────────────────────

export function useSyncProductVariants() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ productId, variants }: { productId: string; variants: { size_id: string; price: number; is_available: boolean }[] }) =>
            api.post<{ data: ApiProduct }>(`/admin/cafe/products/${productId}/sync-variants`, { variants }),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: productQueryKeys.all }); },
    });
}

// kept for internal use (individual add/update/delete still available)
export function useAddVariant() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ productId, ...body }: { productId: string; size_id: string; price: number; is_available?: boolean }) =>
            api.post<{ data: ApiProductVariant }>(`/admin/cafe/products/${productId}/variants`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: productQueryKeys.all }),
    });
}

export function useUpdateVariant() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ productId, variantId, ...body }: { productId: string; variantId: string; size_id?: string; price?: number; is_available?: boolean }) =>
            api.put<{ data: ApiProductVariant }>(`/admin/cafe/products/${productId}/variants/${variantId}`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: productQueryKeys.all }),
    });
}

export function useDeleteVariant() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ productId, variantId }: { productId: string; variantId: string }) =>
            api.delete<{ message: string }>(`/admin/cafe/products/${productId}/variants/${variantId}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: productQueryKeys.all }),
    });
}

// ─── Global Size Hooks ────────────────────────────────────────────────────────

export function useApiSizes() {
    return useQuery({
        queryKey: sizeQueryKeys.all,
        queryFn: () => api.get<{ data: CafeSize[] }>("/admin/cafe/sizes").then((r) => r.data),
        staleTime: 0,
    });
}

export function useCreateSize() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: { name: string; sort_order?: number }) =>
            api.post<{ data: CafeSize }>("/admin/cafe/sizes", body),
        onSuccess: () => qc.invalidateQueries({ queryKey: sizeQueryKeys.all }),
    });
}

export function useUpdateSize() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, ...body }: { id: string; name?: string; sort_order?: number }) =>
            api.put<{ data: CafeSize }>(`/admin/cafe/sizes/${id}`, body),
        onSuccess: () => qc.invalidateQueries({ queryKey: sizeQueryKeys.all }),
    });
}

export function useDeleteSize() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            api.delete<{ message: string }>(`/admin/cafe/sizes/${id}`),
        onSuccess: () => qc.invalidateQueries({ queryKey: sizeQueryKeys.all }),
    });
}

// ─── Linked Addon Hooks ───────────────────────────────────────────────────────

export function useSyncProductAddons() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ productId, addonProductIds }: { productId: string; addonProductIds: string[] }) =>
            api.post<{ data: ApiProduct }>(`/admin/cafe/products/${productId}/sync-addons`, { addon_product_ids: addonProductIds }),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: productQueryKeys.all }); },
    });
}
