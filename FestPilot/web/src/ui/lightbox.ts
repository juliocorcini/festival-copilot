/**
 * Pure geometry for the photo lightbox (E19/DEC-102). The lightbox renders an image inside a
 * full-viewport "world" driven by the shared `usePanZoom` (so the pinch/drag/clamp behaviour matches
 * the map exactly). At rest the photo is *contained* (whole image visible, letterboxed) — unlike the
 * thumbnail, which is cover-cropped — and the honest zoom ceiling reuses the map's `maxScaleForBase`.
 * Kept framework-free so the fit math is unit-tested with concrete pixel sizes.
 */

/** The size an image of natural aspect occupies when *contained* (letterboxed) inside a box. */
export function containedSize(
  naturalW: number,
  naturalH: number,
  boxW: number,
  boxH: number
): { w: number; h: number } {
  if (naturalW <= 0 || naturalH <= 0 || boxW <= 0 || boxH <= 0) return { w: boxW, h: boxH };
  const scale = Math.min(boxW / naturalW, boxH / naturalH);
  return { w: naturalW * scale, h: naturalH * scale };
}
