/**
 * Compress + resize an image in the browser before uploading.
 *
 * Product photos straight from a phone are often 2-5 MB; the POS/menu then
 * re-downloads them full-size on every load (slow, and it burns Supabase
 * egress). This shrinks them to a sane max dimension and re-encodes as WebP,
 * typically ~85% smaller, with no visible quality loss at display size.
 *
 * Fully defensive: SVG/GIF are passed through untouched, and ANY failure
 * returns the original file so an upload is never blocked.
 */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<File> {
  const { maxDim = 1000, quality = 0.8 } = opts;

  // Don't touch vector logos or animated gifs, or non-images.
  if (
    !file.type.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;

    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!blob || blob.size >= file.size) return file; // no win → keep original

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}
