/**
 * Sharing opt-in flag (Phase 5 — DEC-006/015). A device-local boolean: "the user has chosen to
 * share location while FestPilot is foregrounded". It gates whether the geolocation engine runs;
 * the per-squad visibility (stage / precise / ghost) is a separate, server-side choice.
 *
 * Kept as a tiny reactive external store so the consent screen, the roster, and the privacy
 * master-switch all stay in sync within and across tabs.
 */
import { useSyncExternalStore } from "react";

const OPT_IN_KEY = "fp.share.v1";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(OPT_IN_KEY) === "1";
  } catch {
    return false;
  }
}

export function getSharingOptIn(): boolean {
  return read();
}

export function setSharingOptIn(value: boolean): void {
  try {
    if (value) localStorage.setItem(OPT_IN_KEY, "1");
    else localStorage.removeItem(OPT_IN_KEY);
  } catch {
    /* storage unavailable — opt-in simply won't persist */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === OPT_IN_KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSharingOptIn(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
