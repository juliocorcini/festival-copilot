/**
 * Service-worker registration + an honest, *proactive* update flow (R10.2).
 *
 * The SW is registered with a version query (`/sw.js?v=<APP_VERSION>`) so every release ships a
 * distinct script URL: the browser then genuinely re-fetches and installs the new worker, and the
 * SW versions its own caches from that query. A new worker parks in `waiting` (the SW no longer
 * calls skipWaiting on install) until the app activates it.
 *
 * Beyond the manual "Check for updates" (Settings → Offline), an installed app now discovers new
 * versions on its own: it re-checks on launch, whenever it returns to the foreground, when the
 * connection comes back, and on a slow interval. Two signals trigger the in-app "update ready"
 * banner (see UpdateBanner): a freshly *installed & waiting* worker, or the deployed `index.html`
 * no longer referencing the bundle this tab is running (which covers long-open sessions where the
 * worker URL can't change). The banner / force button then `forceUpdate()`s to the latest build.
 */
import { APP_VERSION } from "../data/changelog";

const SW_URL = `/sw.js?v=${APP_VERSION}`;
/** How often an open app re-checks for a new build (it also checks on focus + when back online). */
const UPDATE_POLL_MS = 30 * 60_000;

/** Window event fired once when a newer build is available; the UpdateBanner listens for it. */
export const UPDATE_READY_EVENT = "fp:update-ready";

let updateReady = false;

/** Announce (once) that a newer build is available. Idempotent — repeated signals are coalesced. */
function announceUpdate(): void {
  if (updateReady) return;
  updateReady = true;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(UPDATE_READY_EVENT));
}

/** Whether a newer build has already been detected this session. */
export function hasWaitingUpdate(): boolean {
  return updateReady;
}

/** Subscribe to the "update ready" signal; fires immediately if already detected. Returns unsubscribe. */
export function onUpdateReady(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(UPDATE_READY_EVENT, callback);
  if (updateReady) callback();
  return () => window.removeEventListener(UPDATE_READY_EVENT, callback);
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(SW_URL)
      .then((reg) => wireAutoUpdate(reg))
      .catch((err) => console.warn("[sw] registration failed:", err));
  });
}

/** Wire the automatic discovery: install-time signal, foreground/reconnect/interval re-checks. */
function wireAutoUpdate(reg: ServiceWorkerRegistration): void {
  // A worker already parked from a previous session (app reopened after a deploy).
  if (reg.waiting && navigator.serviceWorker.controller) announceUpdate();

  // A new worker began installing → announce once it's installed (and only if we were already
  // controlled, i.e. it's an update, not the first-ever install).
  reg.addEventListener("updatefound", () => {
    const installing = reg.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) announceUpdate();
    });
  });

  const poke = (): void => {
    reg.update().catch(() => {});
    void deployedDiffers().then((stale) => {
      if (stale) announceUpdate();
    });
  };

  poke();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") poke();
  });
  window.addEventListener("online", poke);
  window.setInterval(poke, UPDATE_POLL_MS);
}

/** The hashed filename of the module bundle this tab is running, e.g. `index-CKz2a2fA.js`. */
function currentBundleFile(): string | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector('script[type="module"][src*="/assets/"]');
  const src = el?.getAttribute("src");
  return src ? (src.split("/").pop() ?? null) : null;
}

/**
 * True when the freshly-fetched deployed shell no longer references the bundle this tab is running —
 * i.e. a new build is live. Covers long-open sessions where the worker's `?v=` URL can't change.
 * Best-effort: any fetch/parse failure (offline, etc.) resolves false so we never false-alarm.
 */
async function deployedDiffers(): Promise<boolean> {
  const current = currentBundleFile();
  if (!current) return false;
  try {
    const res = await fetch("/", { cache: "no-store" });
    if (!res.ok) return false;
    const html = await res.text();
    return !html.includes(current);
  } catch {
    return false;
  }
}

export type UpdateStatus = "updated" | "current" | "unsupported";

/** Ask the browser to re-check the SW; report whether a new version is installed and waiting. */
export async function checkForUpdate(): Promise<UpdateStatus> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "unsupported";

  try {
    await reg.update();
  } catch {
    return "unsupported";
  }

  // An update only makes sense when a worker is already controlling this page.
  if (!navigator.serviceWorker.controller) return "current";
  if (reg.waiting) return "updated";

  // A freshly fetched worker may still be installing — wait for it to settle, then re-check.
  if (reg.installing) {
    const ok = await waitForInstalled(reg.installing);
    if (ok && reg.waiting) return "updated";
  }
  return "current";
}

function waitForInstalled(worker: ServiceWorker, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const finish = (ok: boolean): void => {
      worker.removeEventListener("statechange", onChange);
      resolve(ok);
    };
    const onChange = (): void => {
      if (worker.state === "installed") finish(true);
      else if (worker.state === "redundant") finish(false);
    };
    worker.addEventListener("statechange", onChange);
    window.setTimeout(() => finish(worker.state === "installed"), timeoutMs);
  });
}

/** Activate the waiting worker; `controllerchange` (wired in registerServiceWorker) reloads the page. */
export async function applyUpdate(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
}

/**
 * Force the latest build now. Activates a waiting worker when there is one (which reloads via
 * `controllerchange`); otherwise hard-reloads so the network-first shell pulls the new index +
 * bundle, which then registers the new worker. Used by the banner and the Settings "force" button.
 */
export async function forceUpdate(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    location.reload();
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    location.reload();
    return;
  }
  try {
    await reg.update();
  } catch {
    /* offline — fall through to a plain reload */
  }
  if (reg.waiting) {
    reg.waiting.postMessage({ type: "SKIP_WAITING" });
    return; // controllerchange → reload
  }
  location.reload();
}
