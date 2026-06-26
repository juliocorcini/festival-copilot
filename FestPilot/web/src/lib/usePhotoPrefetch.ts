/**
 * Photo prefetch hook (DEC-067 / IMG-3). Warms the next few artist photos ahead of the one on
 * screen so the swipe deck / lineup scroll never waits on a cold request: when the user lands on
 * the next card its image is already decoded (or served from the SW photo cache). Fire-and-forget —
 * it never blocks render, never awaits, and de-dupes so a given URL is requested at most once.
 *
 * Pure "which to fetch" lives in `prefetchWindow`; this hook is only the DOM side-effect (`new Image`).
 */
import { useEffect, useRef } from "react";
import { artistPhotoSrc, PHOTO_WIDTH } from "./photo";
import { BUFFER_AHEAD, prefetchWindow } from "./photoBuffer";

/**
 * @param urls   ordered image URLs (photoless acts as `null`); memoize in the caller to avoid churn.
 * @param index  the current position; the window follows it (advances on next, rewinds on undo).
 * @param width  CDN resize width to warm — match the surface's `ArtistPhoto width` for a cache hit.
 */
export function usePhotoPrefetch(
  urls: (string | null | undefined)[],
  index: number,
  width: number = PHOTO_WIDTH.card,
  size: number = BUFFER_AHEAD
): void {
  const requested = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof Image === "undefined") return;
    for (const url of prefetchWindow(urls, index, size)) {
      const src = artistPhotoSrc(url, width);
      if (requested.current.has(src)) continue;
      requested.current.add(src);
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, [urls, index, width, size]);
}

/** Widths at which a favorite's photo is pinned offline — the surfaces that show favorites (IMG-5). */
const KEEP_WIDTHS = [PHOTO_WIDTH.detail, PHOTO_WIDTH.list] as const;

/**
 * Ask the service worker to pin these photo URLs in its never-evicted keep cache (IMG-5). No-op when
 * there's no controlling SW (dev, first load, unsupported) — the photos still render, just online.
 */
export function keepPhotos(urls: string[]): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const controller = navigator.serviceWorker.controller;
  if (!controller || urls.length === 0) return;
  controller.postMessage({ type: "KEEP_PHOTOS", urls });
}

/**
 * Keep every favorite's photo available offline (IMG-5). Whenever the favorite set changes, pin the
 * newly-favorited acts' photos (at the widths the favorite surfaces use) so Lineup / My Plan / Now
 * show them without the network — and the LRU never discards a favorite. De-dupes across calls.
 */
export function useKeepFavoritePhotos(
  imageUrlByActKey: Map<string, string | null>,
  favoriteKeys: Set<string>
): void {
  const pinned = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh: string[] = [];
    for (const key of favoriteKeys) {
      const url = imageUrlByActKey.get(key);
      if (!url) continue;
      for (const w of KEEP_WIDTHS) {
        const src = artistPhotoSrc(url, w);
        if (pinned.current.has(src)) continue;
        pinned.current.add(src);
        fresh.push(src);
      }
    }
    if (fresh.length > 0) keepPhotos(fresh);
  }, [imageUrlByActKey, favoriteKeys]);
}
