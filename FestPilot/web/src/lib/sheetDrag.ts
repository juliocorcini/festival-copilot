/**
 * Pure drag-to-dismiss math for bottom sheets (Phase 7 — native-feel polish). No DOM, no React —
 * just the model the `useSheetDrag` hook renders against, so the feel is unit-testable with concrete
 * numbers. Decided by inline council: follow the finger 1:1 downward only, dismiss on a deliberate
 * distance (a quarter of the sheet) OR a fast flick, fade the scrim with travel, arm only at the top.
 */

/** Drag past this fraction of the sheet's own height to dismiss on release. */
export const SHEET_DISMISS_RATIO = 0.25;
/** ...or release with at least this downward speed (px/ms) to dismiss regardless of distance. */
export const SHEET_FLICK_VELOCITY = 0.5;
/** A flick must still travel this far (px) — guards a jittery tap from closing the sheet. */
export const SHEET_FLICK_MIN_PX = 36;

/** Clamp a raw finger delta to a downward-only travel (a sheet never lifts above its resting spot). */
export function clampDrag(dy: number): number {
  return dy > 0 ? dy : 0;
}

/**
 * Whether releasing now should dismiss the sheet: dragged far enough (a quarter of its height) OR a
 * deliberate fast downward flick that has cleared the minimum travel.
 */
export function shouldDismiss(distance: number, height: number, velocity: number): boolean {
  if (height > 0 && distance >= height * SHEET_DISMISS_RATIO) return true;
  return velocity >= SHEET_FLICK_VELOCITY && distance >= SHEET_FLICK_MIN_PX;
}

/**
 * Scrim opacity as the sheet slides away: 1 at rest, easing to 0 as the drag reaches the sheet's full
 * height. Clamped to [0,1] so an over-drag never produces a negative (invalid) opacity.
 */
export function scrimOpacity(distance: number, height: number): number {
  if (height <= 0 || distance <= 0) return 1;
  const remaining = 1 - distance / height;
  if (remaining < 0) return 0;
  if (remaining > 1) return 1;
  return remaining;
}
