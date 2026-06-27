/**
 * Pure geometry for shrink-to-fit text (DEC-087 — the festival name on the home must never be cut
 * with an ellipsis). The font scales down only as far as `minScale`; below that the caller lets the
 * text wrap to a second line instead of shrinking it into illegibility. Kept React/DOM-free so the
 * sizing rule can be unit-tested on its own.
 */

/** Font scale (0 < s ≤ 1) that fits `naturalWidth` into `availableWidth`, never below `minScale`. */
export function fitFontScale(naturalWidth: number, availableWidth: number, minScale: number): number {
  if (naturalWidth <= 0 || availableWidth <= 0) return 1;
  if (availableWidth >= naturalWidth) return 1;
  return Math.max(availableWidth / naturalWidth, minScale);
}

/**
 * True when, even at the chosen scale, the text still overflows one line — the caller should allow
 * it to wrap rather than clip. The half-pixel slack absorbs sub-pixel rounding from layout reads.
 */
export function shouldWrap(naturalWidth: number, availableWidth: number, scale: number): boolean {
  if (naturalWidth <= 0 || availableWidth <= 0) return false;
  return naturalWidth * scale > availableWidth + 0.5;
}
