/**
 * Drag-to-dismiss for the base `<Sheet>` (Phase 7 — D3). Attaches one-finger touch handlers to the
 * sheet element: drag down and the sheet follows the finger 1:1; release past a quarter of its height
 * (or on a fast flick) and it slides out + closes, otherwise it springs back. Mirrors the discipline
 * of pull-to-refresh: arm only when the sheet's scroll body is at the top, and `preventDefault` only
 * once the drag owns the gesture — so an internal scroll never fights the dismiss. Pure math lives in
 * `lib/sheetDrag`; reduced-motion users get an instant cut (no spring, no slide).
 */
import { useEffect, useRef, type RefObject } from "react";
import { haptic } from "../lib/haptics";
import { clampDrag, scrimOpacity, shouldDismiss } from "../lib/sheetDrag";

const SPRING = "transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)";
const EXIT = "transform 0.2s cubic-bezier(0.4, 0, 1, 1)";
const SCRIM_FADE = "opacity 0.2s ease";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useSheetDrag(
  sheetRef: RefObject<HTMLElement>,
  scrimRef: RefObject<HTMLElement>,
  onClose: () => void
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    // The inner scroller that must be at the top before a drag arms; short sheets have none → always
    // armed (querySelector returns null and the scroll guard is skipped). `.sheet-body` is the base
    // Sheet's scroller; `.sheet-scroll` is an unstyled opt-in marker for sheets that keep their own
    // markup (e.g. StagePickSheet's `.stage-sheet-list`) but still want the scroll guard.
    const scroller = sheet.querySelector<HTMLElement>(".sheet-body, .sheet-scroll");

    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let current = 0;
    let armed = false;
    let dragging = false;
    let closing = false;

    const paintScrim = (opacity: number | null): void => {
      const scrim = scrimRef.current;
      if (!scrim) return;
      scrim.style.opacity = opacity == null ? "" : String(opacity);
    };

    const follow = (dy: number): void => {
      current = clampDrag(dy);
      sheet.style.transform = current > 0 ? `translateY(${current}px)` : "";
      paintScrim(current > 0 ? scrimOpacity(current, sheet.offsetHeight || 0) : null);
    };

    const springBack = (): void => {
      current = 0;
      if (prefersReducedMotion()) {
        sheet.style.transform = "";
        paintScrim(null);
        return;
      }
      sheet.style.transition = SPRING;
      sheet.style.transform = "";
      const scrim = scrimRef.current;
      if (scrim) scrim.style.transition = SCRIM_FADE;
      paintScrim(null);
      window.setTimeout(() => {
        sheet.style.transition = "";
        if (scrimRef.current) scrimRef.current.style.transition = "";
      }, 260);
    };

    const dismiss = (): void => {
      if (closing) return;
      closing = true;
      haptic("light");
      const close = (): void => onCloseRef.current();
      if (prefersReducedMotion()) {
        close();
        return;
      }
      let fired = false;
      const fireOnce = (): void => {
        if (fired) return;
        fired = true;
        close();
      };
      sheet.style.transition = EXIT;
      sheet.style.transform = `translateY(${sheet.offsetHeight || 1000}px)`;
      const scrim = scrimRef.current;
      if (scrim) {
        scrim.style.transition = SCRIM_FADE;
        scrim.style.opacity = "0";
      }
      sheet.addEventListener("transitionend", fireOnce, { once: true });
      window.setTimeout(fireOnce, 280); // fallback if the transition is interrupted/missed
    };

    const onStart = (e: TouchEvent): void => {
      if (closing || e.touches.length !== 1 || (scroller && scroller.scrollTop > 0)) {
        armed = false;
        return;
      }
      startY = lastY = e.touches[0]!.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      current = 0;
      armed = true;
      dragging = false;
      sheet.style.transition = "";
    };

    const onMove = (e: TouchEvent): void => {
      if (!armed || closing || e.touches.length !== 1) return;
      if (scroller && scroller.scrollTop > 0) {
        armed = false;
        if (dragging) springBack();
        dragging = false;
        return;
      }
      const y = e.touches[0]!.clientY;
      const dy = y - startY;
      if (dy <= 0) {
        if (dragging) follow(0);
        return;
      }
      // We now own the gesture: stop the body's native scroll while the sheet tracks the finger.
      dragging = true;
      if (e.cancelable) e.preventDefault();
      const dt = e.timeStamp - lastT;
      if (dt > 0) velocity = (y - lastY) / dt;
      lastY = y;
      lastT = e.timeStamp;
      follow(dy);
    };

    const onEnd = (): void => {
      if (!armed) return;
      armed = false;
      if (!dragging) return;
      dragging = false;
      if (shouldDismiss(current, sheet.offsetHeight || 0, velocity)) dismiss();
      else springBack();
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd, { passive: true });
    sheet.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
      sheet.removeEventListener("touchcancel", onEnd);
    };
  }, [sheetRef, scrimRef]);
}
