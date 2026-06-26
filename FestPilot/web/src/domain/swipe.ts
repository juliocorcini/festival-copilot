/**
 * Pure helpers for the onboarding swipe gesture (R5.1). Kept framework-free so the decision
 * thresholds and the card transform are unit-tested without a DOM.
 */

/** Horizontal drag distance (px) past which a slow, deliberate release commits the swipe. */
export const SWIPE_THRESHOLD = 72;

/** Pointer speed (px/ms) past which a *flick* commits even below the distance threshold. */
export const SWIPE_VELOCITY = 0.55;

/** Tiny displacement floor so a fast jitter/tap is never mistaken for a flick. */
export const SWIPE_FLICK_MIN_DX = 28;

export type SwipeOutcome = "keep" | "skip" | null;

/** Right past the threshold = keep, left = skip, otherwise no commit (spring back). */
export function swipeOutcome(dx: number, threshold: number = SWIPE_THRESHOLD): SwipeOutcome {
  if (dx >= threshold) return "keep";
  if (dx <= -threshold) return "skip";
  return null;
}

/**
 * Decide a release using BOTH distance and velocity, so a quick flick commits without dragging the
 * card all the way across (the #1 onboarding complaint). Rules:
 *  - distance commit: a slow drag past `threshold` commits (keep right / skip left);
 *  - flick commit: a fast throw (`|vx| ≥ velocity`) that moved at least `flickMinDx` AND whose
 *    speed agrees with its displacement direction commits — so pulling the finger back at the end
 *    (sign mismatch) cancels instead of firing the wrong way.
 * `vx` is px/ms, positive = rightward.
 */
export function swipeRelease(
  dx: number,
  vx: number,
  threshold: number = SWIPE_THRESHOLD,
  velocity: number = SWIPE_VELOCITY,
  flickMinDx: number = SWIPE_FLICK_MIN_DX
): SwipeOutcome {
  if (dx >= threshold) return "keep";
  if (dx <= -threshold) return "skip";
  const fastEnough = Math.abs(vx) >= velocity;
  const farEnough = Math.abs(dx) >= flickMinDx;
  const sameDirection = dx !== 0 && Math.sign(vx) === Math.sign(dx);
  if (fastEnough && farEnough && sameDirection) return dx > 0 ? "keep" : "skip";
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
