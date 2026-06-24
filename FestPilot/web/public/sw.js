/* FestPilot service worker (hand-written, no build step).
 * Strategy (TripPilot pattern):
 *  - navigations  -> network-first, fall back to the cached app shell (offline SPA).
 *  - /api reads    -> network-first, fall back to cache (lineup/map readable offline).
 *  - static assets -> cache-first + background refresh (stale-while-revalidate).
 * Bump VERSION to invalidate every cache on the next activate.
 */
const VERSION = "festpilot-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const API_CACHE = `${VERSION}-api`;

const SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/maps/tomorrowland-deschorre.webp",
  "/maps/tomorrowland-deschorre-day.webp",
  "/maps/tomorrowland-deschorre-transform.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, SHELL_CACHE, "/index.html"));
    return;
  }
  if (url.pathname.startsWith("/api/") || url.hostname.endsWith("workers.dev")) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }
  event.respondWith(cacheFirst(req, ASSET_CACHE));
});

async function networkFirst(req, cacheName, fallbackPath) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (fallbackPath) {
      const shell = await cache.match(fallbackPath);
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) {
    fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
      })
      .catch(() => {});
    return cached;
  }
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}
