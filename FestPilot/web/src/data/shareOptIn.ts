/**
 * Device-local sharing preferences (Phase 5 — DEC-006/015). These are CLIENT choices, distinct from
 * the per-squad server-side visibility (stage / precise / ghost):
 *   - opt-in: "share location while FestPilot is foregrounded" — gates the geolocation engine;
 *   - default mode: the visibility a new share starts at (#25.6 "Default mode");
 *   - precise minutes: the auto-expiry window applied when going precise (#25.6 stepper).
 * Kept as a tiny reactive external store so the consent screen, the roster, the visibility picker
 * and the privacy screen all stay in sync within and across tabs.
 */
import { useSyncExternalStore } from "react";
import type { ShareMode } from "./types";

const OPT_IN_KEY = "fp.share.v1";
const MODE_KEY = "fp.share.mode.v1";
const EXPIRY_KEY = "fp.share.expiry.v1";

export const PRECISE_MIN = 15;
export const PRECISE_MAX = 180;
export const PRECISE_STEP = 15;
const PRECISE_DEFAULT = 60;

const listeners = new Set<() => void>();

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — the pref simply won't persist */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent): void => {
    if (e.key === OPT_IN_KEY || e.key === MODE_KEY || e.key === EXPIRY_KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

// --- Opt-in (foreground sharing engine on/off) ---
export function getSharingOptIn(): boolean {
  return readLocal(OPT_IN_KEY) === "1";
}
export function setSharingOptIn(value: boolean): void {
  writeLocal(OPT_IN_KEY, value ? "1" : null);
}
export function useSharingOptIn(): boolean {
  return useSyncExternalStore(subscribe, getSharingOptIn, () => false);
}

// --- Default visibility mode for a new share ---
export function getDefaultShareMode(): ShareMode {
  const v = readLocal(MODE_KEY);
  return v === "precise" || v === "ghost" ? v : "stage";
}
export function setDefaultShareMode(mode: ShareMode): void {
  writeLocal(MODE_KEY, mode);
}
export function useDefaultShareMode(): ShareMode {
  return useSyncExternalStore(subscribe, getDefaultShareMode, () => "stage" as ShareMode);
}

// --- Precise auto-expiry window (minutes) ---
function clampMinutes(n: number): number {
  const stepped = Math.round(n / PRECISE_STEP) * PRECISE_STEP;
  return Math.min(PRECISE_MAX, Math.max(PRECISE_MIN, stepped));
}
export function getPreciseMinutes(): number {
  const raw = Number(readLocal(EXPIRY_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampMinutes(raw) : PRECISE_DEFAULT;
}
export function setPreciseMinutes(minutes: number): void {
  writeLocal(EXPIRY_KEY, String(clampMinutes(minutes)));
}
export function usePreciseMinutes(): number {
  return useSyncExternalStore(subscribe, getPreciseMinutes, () => PRECISE_DEFAULT);
}
