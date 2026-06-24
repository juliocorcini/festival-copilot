/**
 * Pure helpers for the onboarding swipe gesture (R5.1). Kept framework-free so the decision
 * thresholds and the card transform are unit-tested without a DOM.
 */

/** Horizontal drag distance (px) past which a release commits the swipe. */
export const SWIPE_THRESHOLD = 90;

export type SwipeOutcome = "keep" | "skip" | null;

/** Right past the threshold = keep, left = skip, otherwise no commit (spring back). */
export function swipeOutcome(dx: number, threshold: number = SWIPE_THRESHOLD): SwipeOutcome {
  if (dx >= threshold) return "keep";
  if (dx <= -threshold) return "skip";
  return null;
}

export interface CardDragStyle {
  transform: string;
  /** 0..1 reveal of the "KEEP" stamp (right drag) and the "SKIP" stamp (left drag). */
  keepOpacity: number;
  skipOpacity: number;
}

/** Card visual for a horizontal drag: translate + a clamped tilt, and the directional stamp reveal. */
export function cardDragStyle(dx: number, threshold: number = SWIPE_THRESHOLD): CardDragStyle {
  const rotation = clamp(dx / 14, -12, 12);
  const magnitude = Math.min(1, Math.abs(dx) / threshold);
  return {
    transform: `translateX(${Math.round(dx)}px) rotate(${rotation.toFixed(2)}deg)`,
    keepOpacity: dx > 0 ? magnitude : 0,
    skipOpacity: dx < 0 ? magnitude : 0,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
