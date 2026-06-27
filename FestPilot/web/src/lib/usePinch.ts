/**
 * Discrete two-finger pinch gesture (R-gesture). Fires `onPinch("out")` when the user spreads their
 * fingers and `onPinch("in")` when they bring them together — used to step the timetable zoom and the
 * lineup column density.
 *
 * DEC-085: **one step per gesture.** The old version re-baselined after each crossing, so a single long
 * pinch could skip several levels (4 → 3 → 2 columns) and feel uncontrollable. Now the tracker latches
 * after the first step and stays locked until the fingers lift, so each deliberate pinch moves exactly
 * one level. The threshold is also wider (40% spread / pinch) so an accidental drift never triggers.
 *
 * Returns a callback ref to spread on the target element (`ref={usePinch(onPinch)}`). A callback ref
 * (not a RefObject) so the listeners attach the moment the node mounts — the timetable/lineup content
 * appears only after data loads, so an effect keyed on a RefObject would never see it.
 *
 * Only fires for genuine two-finger gestures and calls preventDefault on those moves so the page's
 * native viewport pinch-zoom doesn't fight it; single-finger scrolling is never touched.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type PinchDirection = "in" | "out";

/** Spread (out) needs +40%; pinch (in) needs −~29% — symmetric in log-space (`1/1.4`), wider than before. */
export const PINCH_STEP_OUT = 1.4;
export const PINCH_STEP_IN = 1 / PINCH_STEP_OUT;

export interface PinchTracker {
  /** Begin a gesture from the current finger spread (px). Resets the one-step latch. */
  start(spread: number): void;
  /** Feed the current spread; returns a direction the FIRST time a threshold is crossed, then `null`. */
  move(spread: number): PinchDirection | null;
  /** End the gesture (fingers lifted) — clears the baseline and the latch for the next pinch. */
  end(): void;
}

/**
 * Pure gesture state machine (no DOM) so the one-step-per-gesture rule (DEC-085) is unit-testable with
 * concrete spreads. Latches after the first crossing until {@link PinchTracker.end}.
 */
export function createPinchTracker(): PinchTracker {
  let baseline: number | null = null;
  let fired = false;
  return {
    start(spread: number): void {
      baseline = spread;
      fired = false;
    },
    move(spread: number): PinchDirection | null {
      if (baseline === null || fired) return null;
      const ratio = spread / baseline;
      if (ratio >= PINCH_STEP_OUT) {
        fired = true;
        return "out";
      }
      if (ratio <= PINCH_STEP_IN) {
        fired = true;
        return "in";
      }
      return null;
    },
    end(): void {
      baseline = null;
      fired = false;
    },
  };
}

export function usePinch(onPinch: (direction: PinchDirection) => void): (el: HTMLElement | null) => void {
  const callback = useRef(onPinch);
  callback.current = onPinch;
  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;

    const tracker = createPinchTracker();
    const spread = (touches: TouchList): number =>
      Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);

    const onStart = (e: TouchEvent): void => {
      if (e.touches.length === 2) tracker.start(spread(e.touches));
    };
    const onMove = (e: TouchEvent): void => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const dir = tracker.move(spread(e.touches));
      if (dir) callback.current(dir);
    };
    const onEnd = (e: TouchEvent): void => {
      if (e.touches.length < 2) tracker.end();
    };

    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd, { passive: true });
    node.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
    };
  }, [node]);

  return ref;
}
