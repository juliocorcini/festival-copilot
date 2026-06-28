/* FestPilot service worker (hand-written, no build step).
 * Strategy (TripPilot pattern):
 *  - navigations  -> network-first, fall back to the cached app shell (offline SPA).
 *  - /api reads    -> network-first, fall back to cache (lineup/map readable offline).
 *  - static assets -> cache-first + background refresh (stale-while-revalidate).
 * VERSION is derived from the `?v=` registration query (APP_VERSION), so each release ships a fresh
 * worker + cache namespace and the in-app "Check for updates" can detect a genuinely new version.
 */
const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const VERSION = `festpilot-${SW_VERSION}`;
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const API_CACHE = `${VERSION}-api`;
// Artist photos (DEC-067 / IMG-4) get a dedicated cache so they survive an app-shell/asset refresh
// and stay available offline. They're cross-origin (opaque) and immutable per URL (they carry a
// `?width=`), so we cache even opaque responses and cap the count to keep storage bounded.
const PHOTO_CACHE = `${VERSION}-photos`;
// Favorites' photos (DEC-067 / IMG-5) live in a separate, never-evicted cache so the LRU above can
// never drop them — the user's own picks are guaranteed to render offline ("from my own phone").
const PHOTO_KEEP_CACHE = `${VERSION}-photos-keep`;
const MAX_PHOTOS = 300;
const PHOTO_HOSTS = new Set(["artist-lineup-cdn.tomorrowland.com"]);

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
  // No skipWaiting here: a new worker parks in `waiting` so the app can offer an honest
  // "update ready — reload?" prompt. The very first install (no active worker) activates
  // immediately anyway, so first-load offline still works.
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  // IMG-5: the app asks to pin a favorite's photos (detail + list widths) so they're kept offline.
  if (event.data.type === "KEEP_PHOTOS" && Array.isArray(event.data.urls)) {
    event.waitUntil(keepPhotos(event.data.urls));
  }
});

// Fetch and store favorite photos in the never-evicted keep cache. Already-kept URLs are skipped,
// and an offline failure is swallowed (it'll be pinned next time the act is favorited online).
async function keepPhotos(urls) {
  const cache = await caches.open(PHOTO_KEEP_CACHE);
  await Promise.all(
    urls.map(async (url) => {
      if (await cache.match(url)) return;
      try {
        const res = await fetch(url, { mode: "no-cors" });
        if (res && (res.ok || res.type === "opaque")) await cache.put(url, res.clone());
      } catch {
        /* offline — pin it on the next online favorite */
      }
    })
  );
}

// Tapping a local reminder (E25/DEC-105) focuses an open tab, or opens the app if none is open.
// `data.url` (when set) routes to a specific screen; otherwise it lands on the home.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          if (target !== "/" && "navigate" in client) client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
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
  if (isPhotoRequest(req, url)) {
    event.respondWith(cacheFirstPhoto(req));
    return;
  }
  event.respondWith(cacheFirst(req, ASSET_CACHE));
});

// A request is an artist photo if it hits a known photo CDN, or is any cross-origin image (so other
// festivals' photo hosts are covered without a hardcoded list). Same-origin images (map, icons) are
// app assets and stay in ASSET_CACHE.
function isPhotoRequest(req, url) {
  return (
    PHOTO_HOSTS.has(url.hostname) ||
    (req.destination === "image" && url.origin !== self.location.origin)
  );
}

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

// Cache-first for artist photos (IMG-4). A photo is immutable per URL, so a cache hit returns it
// directly with no background refresh. Misses fetch, then cache the response even when it's opaque
// (cross-origin no-cors): opaque bodies aren't readable but ARE displayable in an <img>, which is
// all we need offline. After each new store, evict the oldest entries past the cap.
async function cacheFirstPhoto(req) {
  // Kept favorites win (IMG-5): they're served from the durable cache and never need the network.
  const kept = await caches.open(PHOTO_KEEP_CACHE).then((c) => c.match(req));
  if (kept) return kept;
  const cache = await caches.open(PHOTO_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && (res.ok || res.type === "opaque")) {
    await cache.put(req, res.clone());
    await enforcePhotoCap(cache);
  }
  return res;
}

// Keep the photo cache bounded by count. `cache.keys()` preserves insertion order, so the oldest
// entries are first — drop them until we're back under MAX_PHOTOS.
async function enforcePhotoCap(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PHOTOS; i++) await cache.delete(keys[i]);
}
