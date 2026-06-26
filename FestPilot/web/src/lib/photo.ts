/**
 * Artist photo URL helper (DEC-061). The live CDN already serves the artist image; we just request
 * a right-sized variant via its `?width=` resizer and URL-encode the path (these URLs contain raw
 * spaces, e.g. ".../233262902-Presspic Bassbrain - 4.jpg"). Pure + unit-tested.
 */

/** Per-surface widths (≈ the rendered px, allowing for 2x): avatar, list, grid, card. */
export const PHOTO_WIDTH = { avatar: 96, list: 160, grid: 220, card: 360 } as const;

export function artistPhotoSrc(url: string, width: number): string {
  const encoded = encodeUriIdempotent(url.trim());
  const sep = encoded.includes("?") ? "&" : "?";
  return `${encoded}${sep}width=${Math.round(width)}`;
}

/**
 * Encode a URL's unsafe characters (the live URLs carry raw spaces) without double-encoding an
 * already-encoded one: decode first so `%20` → space, then re-encode. Falls back to a plain encode
 * if the input is malformed (a lone `%`), and to the raw string as a last resort.
 */
function encodeUriIdempotent(url: string): string {
  try {
    return encodeURI(decodeURI(url));
  } catch {
    try {
      return encodeURI(url);
    } catch {
      return url;
    }
  }
}
