import { supabase } from "./supabase";
import { api } from "./api";

const BUCKET = "products";

/**
 * Upload a product image file to Supabase Storage.
 * Returns the public CDN URL of the uploaded file.
 */
export async function uploadProductImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Upload a logo / brand image to Supabase Storage.
 * Stored in the brand/ folder of the same bucket.
 * Returns the public CDN URL.
 */
export async function uploadLogoImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `brand/logo-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Upload an inventory item image to Supabase Storage.
 * Stored in the inventory/ folder of the same bucket.
 * Returns the public CDN URL.
 */
export async function uploadInventoryImage(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `inventory/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
}

/**
 * Delete a product image via the backend (uses Supabase service role key server-side).
 * Safe to call even if the URL is not a Supabase storage URL — it will be a no-op.
 */
export async function deleteProductImage(url: string): Promise<void> {
    const marker = `/object/public/products/`;
    if (!url.includes(marker)) return; // not a Supabase storage URL, skip silently
    await api.delete('/admin/cafe/storage/image', { url });
}
