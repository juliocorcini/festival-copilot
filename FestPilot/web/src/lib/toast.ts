/**
 * Unified toast feedback (Phase 10 — "feel like a real app"). One tiny, framework-light store that any
 * surface can call imperatively (`toast.success("Saved")`), mirroring how `haptic()` is already used —
 * no context threaded through the tree. A single <Toaster/> (mounted once at the root) subscribes and
 * renders the live stack. Toasts are paired feedback: a short visual + an optional haptic, never the
 * only signal. Auto-dismiss; keyed toasts coalesce (rapid repeats replace, never pile up); the stack
 * is capped so a burst can't bury the screen.
 *
 * The store is plain module state so the queue logic is unit-testable without React.
 */
import { haptic, type Haptic } from "./haptics";

export type ToastTone = "info" | "success" | "error";

export interface ToastOptions {
  tone?: ToastTone;
  /** Auto-dismiss after this many ms; 0 keeps it until tapped. Defaults per tone. */
  durationMs?: number;
  /** Material Symbols glyph; defaults per tone. */
  icon?: string;
  /** Same-key toasts replace each other (e.g. spamming a favorite heart shows one toast). */
  key?: string;
  /** Haptic to fire on show; `false` to stay silent (e.g. the triggering tap already buzzed). */
  haptic?: Haptic | false;
}

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
  icon: string;
  durationMs: number;
  key?: string;
}

const DEFAULT_DURATION_MS: Record<ToastTone, number> = { info: 2600, success: 2600, error: 4200 };
const TONE_ICON: Record<ToastTone, string> = { info: "info", success: "check_circle", error: "error" };
const TONE_HAPTIC: Record<ToastTone, Haptic> = { info: "light", success: "success", error: "error" };
/** Never show more than this many at once — a burst drops the oldest. */
const MAX_VISIBLE = 3;

let toasts: Toast[] = [];
let sequence = 0;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function notify(): void {
  for (const listener of listeners) listener();
}

function clearTimer(id: number): void {
  const handle = timers.get(id);
  if (handle != null) {
    clearTimeout(handle);
    timers.delete(id);
  }
}

/** Subscribe to stack changes (used by the <Toaster/> via useSyncExternalStore). */
export function subscribeToasts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current stack — a stable reference between changes so external-store reads don't loop. */
export function getToasts(): Toast[] {
  return toasts;
}

export function dismissToast(id: number): void {
  clearTimer(id);
  const next = toasts.filter((toast) => toast.id !== id);
  if (next.length !== toasts.length) {
    toasts = next;
    notify();
  }
}

/** Show a toast; returns its id. Strings are treated as `{ message }` with the default (info) tone. */
export function showToast(input: string | (ToastOptions & { message: string })): number {
  const config = typeof input === "string" ? { message: input } : input;
  const tone: ToastTone = config.tone ?? "info";
  const entry: Toast = {
    id: ++sequence,
    message: config.message,
    tone,
    icon: config.icon ?? TONE_ICON[tone],
    durationMs: config.durationMs ?? DEFAULT_DURATION_MS[tone],
    key: config.key,
  };

  // Keyed toasts replace any predecessor so rapid repeats coalesce into a single, refreshed toast.
  const kept = entry.key ? toasts.filter((toast) => toast.key !== entry.key) : toasts;
  if (entry.key) {
    for (const toast of toasts) if (toast.key === entry.key) clearTimer(toast.id);
  }
  toasts = [...kept, entry].slice(-MAX_VISIBLE);

  const buzz = config.haptic === undefined ? TONE_HAPTIC[tone] : config.haptic;
  if (buzz) haptic(buzz);

  if (entry.durationMs > 0) {
    timers.set(
      entry.id,
      setTimeout(() => dismissToast(entry.id), entry.durationMs)
    );
  }
  notify();
  return entry.id;
}

/** Imperative facade — mirrors the `haptic()` ergonomics. Import `toast` and call from any handler. */
export const toast = {
  show: showToast,
  info: (message: string, options?: Omit<ToastOptions, "tone">): number => showToast({ ...options, message, tone: "info" }),
  success: (message: string, options?: Omit<ToastOptions, "tone">): number =>
    showToast({ ...options, message, tone: "success" }),
  error: (message: string, options?: Omit<ToastOptions, "tone">): number =>
    showToast({ ...options, message, tone: "error" }),
  dismiss: dismissToast,
};

/** Test-only reset so suites start from a clean stack. */
export function _resetToasts(): void {
  for (const id of timers.keys()) clearTimer(id);
  toasts = [];
  sequence = 0;
}
