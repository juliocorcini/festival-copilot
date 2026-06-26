/**
 * Photo prefetch buffer (DEC-067 / IMG-2). Pure logic that decides WHICH artist photos to warm
 * ahead of the one on screen, so swiping/scrolling never waits on a cold network request. The
 * caller (a prefetch hook) feeds the ordered list of image URLs and the current index; this returns
 * the next batch of distinct, non-null URLs to kick off. No DOM, no network — just the "which".
 */

/** How many photos to keep warm ahead of (and including) the current one. */
export const BUFFER_AHEAD = 5;

/**
 * The next `size` distinct, non-null image URLs starting at `index` (inclusive), in order. Artists
 * without a photo (`null`/empty) are skipped — they cost no request — and duplicate URLs collapse
 * to one. Near the end of the list it returns however many remain (possibly fewer than `size`).
 */
export function prefetchWindow(
  urls: (string | null | undefined)[],
  index: number,
  size: number = BUFFER_AHEAD
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = Math.max(0, index); i < urls.length && out.length < size; i++) {
    const url = urls[i];
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}
