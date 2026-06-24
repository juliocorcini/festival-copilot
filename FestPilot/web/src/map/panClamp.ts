/**
 * Pure pan/zoom geometry for the map (R2.1, §6 #4/#6).
 *
 * The map art is a fixed "world" of `world.w × world.h` CSS px rendered into a viewport at a given
 * `scale` and translation `(x, y)` (world top-left in viewport coordinates). Two problems the review
 * hit, both fixed here as pure, testable math:
 *   1. dragging past the art exposed a black void — `clampPan` keeps the scaled world covering the
 *      viewport's *safe rect* (a small `bleed` is tolerated);
 *   2. the in-canvas chrome (top bar + bottom sheet) hid the venue — the *safe rect* is the viewport
 *      minus `insets`, so `fitView` frames the venue inside the visible area, not behind the chrome.
 */
export interface Size {
  w: number;
  h: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface View {
  x: number;
  y: number;
  scale: number;
}

export const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

/** The viewport rect actually free of chrome: [left, right] × [top, bottom] in viewport px. */
function safeRect(viewport: Size, insets: Insets): { x0: number; y0: number; w: number; h: number } {
  return {
    x0: insets.left,
    y0: insets.top,
    w: Math.max(1, viewport.w - insets.left - insets.right),
    h: Math.max(1, viewport.h - insets.top - insets.bottom),
  };
}

/** The scale that makes the whole world fit inside the safe rect (its natural "fit" / min zoom). */
export function fitScale(world: Size, viewport: Size, insets: Insets = NO_INSETS): number {
  if (world.w <= 0 || world.h <= 0) return 1;
  const safe = safeRect(viewport, insets);
  return Math.min(safe.w / world.w, safe.h / world.h);
}

/**
 * Clamp one axis so the scaled world keeps covering the safe span [s0, s0 + safeLen].
 * When the world is smaller than the span (zoomed out below fit) it is centred instead.
 */
function clampAxis(pos: number, worldLen: number, s0: number, safeLen: number, bleed: number): number {
  const maxStart = s0 + bleed; // world's near edge may sit at most `bleed` inside the safe edge
  const minStart = s0 + safeLen - bleed - worldLen; // world's far edge may fall at most `bleed` short
  if (minStart > maxStart) return s0 + (safeLen - worldLen) / 2; // smaller than the span → centre
  return Math.max(minStart, Math.min(pos, maxStart));
}

/**
 * Clamp the translation so the user can never drag the art off the safe rect into the void.
 * `bleed` is the cosmetic gap (px) tolerated at an edge before the clamp bites.
 */
export function clampPan(
  view: View,
  world: Size,
  viewport: Size,
  insets: Insets = NO_INSETS,
  bleed = 0,
): View {
  const safe = safeRect(viewport, insets);
  return {
    scale: view.scale,
    x: clampAxis(view.x, world.w * view.scale, safe.x0, safe.w, bleed),
    y: clampAxis(view.y, world.h * view.scale, safe.y0, safe.h, bleed),
  };
}

/** Fit the world into the safe rect and centre it there — the default "recenter" view. */
export function fitView(world: Size, viewport: Size, insets: Insets = NO_INSETS): View {
  const scale = fitScale(world, viewport, insets);
  const safe = safeRect(viewport, insets);
  return {
    scale,
    x: safe.x0 + (safe.w - world.w * scale) / 2,
    y: safe.y0 + (safe.h - world.h * scale) / 2,
  };
}
