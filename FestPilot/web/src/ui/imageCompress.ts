/**
 * Client-side image compression for avatars (DEC-059). The server caps uploads at ~256 KB, so we
 * downscale to a small square and step JPEG quality down until the blob fits the target budget. This
 * keeps R2 writes tiny (the app-enforced quota lives server-side; this just stops oversize uploads at
 * the source). Pure browser APIs — no dependency.
 */

const MAX_DIMENSION = 512; // an avatar never renders larger than this
const TARGET_BYTES = 150 * 1024; // DEC-059 client target (~150 KB)
const MIN_QUALITY = 0.4;

export interface CompressedImage {
  blob: Blob;
  contentType: string;
}

/** Decode a File/Blob into an ImageBitmap (falls back to an <img> for older Safari). */
async function decode(file: Blob): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

/**
 * Downscale to a centered square ≤ MAX_DIMENSION and encode as JPEG under the target budget. Throws
 * when the file can't be decoded as an image (the caller shows an honest error).
 */
export async function compressAvatar(file: Blob): Promise<CompressedImage> {
  const src = await decode(file);
  const side = Math.min(src.width, src.height);
  const scale = Math.min(1, MAX_DIMENSION / side);
  const out = Math.max(1, Math.round(side * scale));

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  // Center-crop to a square, then draw the scaled source.
  const sx = (src.width - side) / 2;
  const sy = (src.height - side) / 2;
  if (typeof createImageBitmap === "function") {
    // Re-decode cropped for crispness when bitmaps are available.
    const bitmap = await createImageBitmap(file, sx, sy, side, side, { resizeWidth: out, resizeHeight: out });
    ctx.drawImage(bitmap, 0, 0);
  } else {
    ctx.save();
    ctx.translate(-sx * scale, -sy * scale);
    src.draw(ctx, src.width * scale, src.height * scale);
    ctx.restore();
  }

  const type = "image/jpeg";
  let quality = 0.82;
  let blob = await canvasToBlob(canvas, type, quality);
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("encode failed");
  return { blob, contentType: type };
}
