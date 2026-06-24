/**
 * Client-side image compression for uploads (DEC-059/047). The server caps uploads, so we downscale
 * and step JPEG quality down until the blob fits the target budget. This keeps R2 writes tiny (the
 * app-enforced quota lives server-side; this just stops oversize uploads at the source). Pure browser
 * APIs — no dependency. Avatars are centre-cropped to a square; meeting-point photos keep their aspect.
 */

export interface CompressOptions {
  /** Longest edge of the output (px). */
  maxDimension: number;
  /** Target blob size (bytes); quality steps down toward this. */
  targetBytes: number;
  /** Centre-crop to a square (avatars). When false, the aspect ratio is preserved. */
  square: boolean;
}

const AVATAR_OPTS: CompressOptions = { maxDimension: 512, targetBytes: 150 * 1024, square: true };
const MEETING_OPTS: CompressOptions = { maxDimension: 1280, targetBytes: 400 * 1024, square: false };
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
 * Downscale + encode as JPEG under the target budget. Square mode centre-crops (avatars); otherwise
 * the aspect ratio is preserved (meeting photos). Throws when the file can't be decoded as an image
 * (the caller shows an honest error).
 */
export async function compressImage(file: Blob, opts: CompressOptions): Promise<CompressedImage> {
  const src = await decode(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  if (opts.square) {
    const side = Math.min(src.width, src.height);
    const out = Math.max(1, Math.round(Math.min(side, opts.maxDimension)));
    canvas.width = out;
    canvas.height = out;
    const sx = (src.width - side) / 2;
    const sy = (src.height - side) / 2;
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file, sx, sy, side, side, { resizeWidth: out, resizeHeight: out });
      ctx.drawImage(bitmap, 0, 0);
    } else {
      const scale = out / side;
      ctx.save();
      ctx.translate(-sx * scale, -sy * scale);
      src.draw(ctx, src.width * scale, src.height * scale);
      ctx.restore();
    }
  } else {
    const scale = Math.min(1, opts.maxDimension / Math.max(src.width, src.height));
    canvas.width = Math.max(1, Math.round(src.width * scale));
    canvas.height = Math.max(1, Math.round(src.height * scale));
    src.draw(ctx, canvas.width, canvas.height);
  }

  const type = "image/jpeg";
  let quality = 0.82;
  let blob = await canvasToBlob(canvas, type, quality);
  while (blob && blob.size > opts.targetBytes && quality > MIN_QUALITY) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, type, quality);
  }
  if (!blob) throw new Error("encode failed");
  return { blob, contentType: type };
}

/** Avatar: centre-cropped square ≤512px, ~150 KB (DEC-059). */
export function compressAvatar(file: Blob): Promise<CompressedImage> {
  return compressImage(file, AVATAR_OPTS);
}

/** Meeting-point photo: aspect-preserving ≤1280px, ~400 KB (DEC-047). */
export function compressMeetingPhoto(file: Blob): Promise<CompressedImage> {
  return compressImage(file, MEETING_OPTS);
}
