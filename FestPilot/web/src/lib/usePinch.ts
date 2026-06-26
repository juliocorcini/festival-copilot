/**
 * Discrete two-finger pinch gesture (R-gesture). Fires `onPinch("out")` when the user spreads their
 * fingers and `onPinch("in")` when they bring them together, once per threshold crossing — used to
 * step the timetable zoom and the lineup column density. It re-baselines after each step so one long
 * pinch can advance multiple steps (e.g. 4 → 3 → 2 columns).
 *
 * Returns a callback ref to spread on the target element (`ref={usePinch(onPinch)}`). A callback ref
 * (not a RefObject) so the listeners attach the moment the node mounts — the timetable/lineup content
 * appears only after data loads, so an effect keyed on a RefObject would never see it.
 *
 * Only fires for genuine two-finger gestures and calls preventDefault on those moves so the page's
 * native viewport pinch-zoom doesn't fight it; single-finger scrolling is never touched.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const STEP_OUT = 1.25; // fingers spread 25% → zoom in / fewer columns
const STEP_IN = 0.8; // fingers pinch to 80% → zoom out / more columns

export function usePinch(onPinch: (direction: "in" | "out") => void): (el: HTMLElement | null) => void {
  const callback = useRef(onPinch);
  callback.current = onPinch;
  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);

  useEffect(() => {
    if (!node) return;

    let baseline: number | null = null;
    const spread = (touches: TouchList): number =>
      Math.hypot(touches[0]!.clientX - touches[1]!.clientX, touches[0]!.clientY - touches[1]!.clientY);

    const onStart = (e: TouchEvent): void => {
      if (e.touches.length === 2) baseline = spread(e.touches);
    };
    const onMove = (e: TouchEvent): void => {
      if (e.touches.length !== 2 || baseline === null) return;
      e.preventDefault();
      const ratio = spread(e.touches) / baseline;
      if (ratio >= STEP_OUT) {
        callback.current("out");
        baseline = spread(e.touches);
      } else if (ratio <= STEP_IN) {
        callback.current("in");
        baseline = spread(e.touches);
      }
    };
    const onEnd = (e: TouchEvent): void => {
      if (e.touches.length < 2) baseline = null;
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
