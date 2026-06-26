/**
 * Haptic feedback (R10.x — "feel like a real app"). A tiny semantic wrapper over the Web Vibration
 * API, gated on a user setting. Pulses are deliberately short so they read as confirmation, not buzz.
 *
 * Coverage is hybrid (decided by inline council):
 *  - a global, capture-phase `pointerdown` delegate gives every real control (`button`,
 *    `[role=button]`) an immediate light tap — opt a control out with `data-haptic="off"`, or
 *    upgrade it with `data-haptic="select|success|…"`.
 *  - result-time moments (lock-in done, errors, SOS) call `haptic(kind)` imperatively.
 *
 * iOS Safari has no Vibration API (verified), so every call is a safe no-op there. Haptics is always
 * paired with a visual signal — it is never the only feedback channel.
 */
import { hapticsEnabled } from "../app/settings";

export type Haptic = "light" | "select" | "medium" | "success" | "warning" | "error" | "heavy";

const PATTERNS: Record<Haptic, number | number[]> = {
  light: 8,
  select: 12,
  medium: 18,
  heavy: 32,
  success: [12, 28, 18],
  warning: [20, 40, 20],
  error: [28, 44, 28, 44],
};

/** Whether this engine can actually vibrate (false on iOS Safari and desktops without the API). */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/** Fire a named haptic, if supported and enabled by the user. Safe to call anywhere. */
export function haptic(kind: Haptic = "light"): void {
  if (!canVibrate() || !hapticsEnabled()) return;
  try {
    navigator.vibrate(PATTERNS[kind] ?? PATTERNS.light);
  } catch {
    /* some engines throw without a prior user gesture — ignore */
  }
}

const CONTROL_SELECTOR = "button, [role='button']";

/**
 * Install the global tap delegate (call once at boot). A capture-phase, passive `pointerdown` so the
 * pulse lands the instant a control is pressed — the most native-feeling moment. The pattern is read
 * from the control's `data-haptic` attribute (`off` skips; otherwise the named kind; default light).
 */
export function initHaptics(): void {
  if (typeof document === "undefined") return;
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Element | null;
      const control = target?.closest?.(CONTROL_SELECTOR) as HTMLElement | null;
      if (!control || control.hasAttribute("disabled") || control.getAttribute("aria-disabled") === "true") return;
      const attr = control.getAttribute("data-haptic");
      if (attr === "off") return;
      haptic(isHaptic(attr) ? attr : "light");
    },
    { passive: true, capture: true }
  );
}

function isHaptic(value: string | null): value is Haptic {
  return value != null && value in PATTERNS;
}
