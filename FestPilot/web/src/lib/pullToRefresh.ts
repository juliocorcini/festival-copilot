/**
 * Pure pull-to-refresh math (Phase 4 — native-feel polish). No DOM, no React — just the gesture
 * model the `<PullToRefresh>` component renders against, so the feel is unit-testable with concrete
 * numbers. Decided by inline council: indicator-only (never transform the content, which would break
 * the fixed view-switch dock), generous rubber-band trigger, haptic at the crossing, min-spin hold.
 */

/** Resting travel of the spinner once a refresh fires (px from the top of the scroller). */
export const PULL_MAX = 90;
/** Pull past this (resisted px) to arm a refresh — generous so a fast scroll-up never triggers it. */
export const PULL_TRIGGER = 64;
/** Hold the spinner at least this long so a silent revalidate still reads as a real refresh. */
export const MIN_SPIN_MS = 600;

/**
 * Rubber-band a raw finger travel into a resisted pull distance that asymptotes to `max` — the pull
 * gets progressively heavier and can never exceed `max`, so the indicator never runs off-screen.
 * `raw=0 → 0`, `raw=max → max/2`, `raw=2·max → 2·max/3`, `raw→∞ → max`.
 */
export function resistPull(rawDistance: number, max: number = PULL_MAX): number {
  if (rawDistance <= 0) return 0;
  return max * (1 - 1 / (rawDistance / max + 1));
}

/** Whether the current resisted distance is past the arm threshold. */
export function shouldTrigger(distance: number, trigger: number = PULL_TRIGGER): boolean {
  return distance >= trigger;
}

/** Pull completion as a clamped 0..1 fraction of the trigger — drives opacity + spinner rotation. */
export function pullProgress(distance: number, trigger: number = PULL_TRIGGER): number {
  if (distance <= 0) return 0;
  const p = distance / trigger;
  return p > 1 ? 1 : p;
}

/** Degrees to rotate the spinner glyph while pulling (a near-full turn as you reach the trigger). */
export function pullRotation(distance: number, trigger: number = PULL_TRIGGER): number {
  return pullProgress(distance, trigger) * 300;
}
