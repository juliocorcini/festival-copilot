/**
 * WCAG contrast helpers (R10.4). Avatar/badge bubbles paint initials over a user- or stage-chosen
 * color; a fixed dark ink is illegible on the darker palette entries (e.g. the violet #7C3AED gives
 * ~3.4:1, below AA). `readableInkOn` picks near-black vs white by whichever has the higher contrast,
 * so initials stay readable on every color. Pure + tested.
 */
const INK_DARK = "#0F0D09";
const INK_LIGHT = "#FFFFFF";

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** WCAG relative luminance of an sRGB hex color (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colors (1 → identical, 21 → black vs white). */
export function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** Readable text ink for content on a solid `bg`: near-black or white, whichever contrasts more. */
export function readableInkOn(bg: string): string {
  return contrastRatio(bg, INK_DARK) >= contrastRatio(bg, INK_LIGHT) ? INK_DARK : INK_LIGHT;
}
