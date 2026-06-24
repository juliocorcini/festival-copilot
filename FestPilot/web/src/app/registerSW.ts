/**
 * Service-worker registration + an honest update flow (R10.2).
 *
 * The SW is registered with a version query (`/sw.js?v=<APP_VERSION>`) so every release ships a
 * distinct script URL: the browser then genuinely re-fetches and installs the new worker, and the
 * SW versions its own caches from that query. The new worker parks in `waiting` (the SW no longer
 * calls skipWaiting on install) until the user opts to update — `checkForUpdate` reports whether an
 * update is actually waiting, and `applyUpdate` activates it, after which `controllerchange` reloads
 * the page exactly once.
 */
import { APP_VERSION } from "../data/changelog";

const SW_URL = `/sw.js?v=${APP_VERSION}`;

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
    navigator.serviceWorker.register(SW_URL).catch((err) => {
      console.warn("[sw] registration failed:", err);
    });
  });
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
