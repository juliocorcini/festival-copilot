/**
 * Pull-to-refresh (Phase 4 — native-feel polish). A self-contained affordance: drop it at the top of
 * a scrollable screen and it finds the shared scroll container (`.scr`) via `closest`, owns the
 * one-finger-at-the-top pull, and renders only a spinner — it never wraps or transforms the screen
 * content (that would break the `position:fixed` view-switch dock; same constraint as the route fade).
 *
 * Council guards: arm only with a single finger at `scrollTop<=0`; `preventDefault` *only* once we own
 * the pull (so normal scrolling and the 2-finger lineup pinch are untouched); lock while refreshing;
 * a haptic tick at the trigger crossing; hold the spinner a min duration so a silent revalidate still
 * reads as a real refresh. The gesture math lives in `lib/pullToRefresh` (pure, unit-tested).
 */
import { useEffect, useRef, useState } from "react";
import { haptic } from "../lib/haptics";
import {
  MIN_SPIN_MS,
  PULL_MAX,
  PULL_TRIGGER,
  pullProgress,
  pullRotation,
  resistPull,
  shouldTrigger,
} from "../lib/pullToRefresh";

interface PullToRefreshProps {
  /** Refresh the screen's data. May be sync (void) or async; the spinner waits for a returned promise. */
  onRefresh: () => void | Promise<unknown>;
  /** Suspend the gesture without unmounting (e.g. while a modal owns the screen). */
  disabled?: boolean;
}

export function PullToRefresh({ onRefresh, disabled = false }: PullToRefreshProps): JSX.Element {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Latest props for the imperative (non-React) touch handlers.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  // Mirrors of render state the handlers read synchronously.
  const refreshingRef = useRef(false);
  const distanceRef = useRef(0);
  const setPull = (d: number): void => {
    distanceRef.current = d;
    setDistance(d);
  };

  useEffect(() => {
    const scroller = anchorRef.current?.closest<HTMLElement>(".scr");
    if (!scroller) return;

    let startY = 0;
    let armed = false;
    let pulling = false;
    let crossed = false;

    const collapse = (): void => {
      pulling = false;
      setDragging(false);
      setPull(0);
    };

    const runRefresh = async (): Promise<void> => {
      refreshingRef.current = true;
      setRefreshing(true);
      setDragging(false);
      setPull(PULL_TRIGGER);
      haptic("light");
      const started = Date.now();
      try {
        await Promise.resolve(onRefreshRef.current());
      } catch {
        /* the screen owns error display; PTR just stops spinning */
      } finally {
        const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - started));
        window.setTimeout(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
        }, wait);
      }
    };

    const onStart = (e: TouchEvent): void => {
      if (disabledRef.current || refreshingRef.current || e.touches.length !== 1 || scroller.scrollTop > 0) {
        armed = false;
        return;
      }
      startY = e.touches[0]!.clientY;
      armed = true;
      pulling = false;
      crossed = false;
    };

    const onMove = (e: TouchEvent): void => {
      if (!armed || refreshingRef.current || e.touches.length !== 1) return;
      if (scroller.scrollTop > 0) {
        armed = false;
        if (pulling) collapse();
        return;
      }
      const dy = e.touches[0]!.clientY - startY;
      if (dy <= 0) {
        if (pulling) collapse();
        return;
      }
      // We now own the gesture: stop the native rubber-band/scroll while the user pulls.
      pulling = true;
      setDragging(true);
      if (e.cancelable) e.preventDefault();
      const d = resistPull(dy, PULL_MAX);
      setPull(d);
      const past = shouldTrigger(d, PULL_TRIGGER);
      if (past && !crossed) {
        crossed = true;
        haptic("select"); // the "release to refresh" tick
      } else if (!past) {
        crossed = false;
      }
    };

    const onEnd = (): void => {
      if (!armed) return;
      const fire = pulling && shouldTrigger(distanceRef.current, PULL_TRIGGER);
      armed = false;
      pulling = false;
      crossed = false;
      if (fire) void runRefresh();
      else collapse();
    };

    scroller.addEventListener("touchstart", onStart, { passive: true });
    scroller.addEventListener("touchmove", onMove, { passive: false });
    scroller.addEventListener("touchend", onEnd, { passive: true });
    scroller.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      scroller.removeEventListener("touchstart", onStart);
      scroller.removeEventListener("touchmove", onMove);
      scroller.removeEventListener("touchend", onEnd);
      scroller.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const visible = distance > 0 || refreshing;
  const glyphStyle = refreshing ? undefined : { transform: `rotate(${pullRotation(distance)}deg)` };

  return (
    <div
      ref={anchorRef}
      className={`ptr${visible ? " on" : ""}${dragging ? " dragging" : ""}`}
      style={{ transform: `translate(-50%, ${distance}px)`, opacity: refreshing ? 1 : pullProgress(distance) }}
      role={refreshing ? "status" : undefined}
      aria-label={refreshing ? "Refreshing" : undefined}
      aria-hidden={refreshing ? undefined : true}
    >
      <span className={`ms ptr-glyph${refreshing ? " ptr-spin" : ""}`} style={glyphStyle}>
        sync
      </span>
    </div>
  );
}
