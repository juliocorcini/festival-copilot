/**
 * Real-viewport height pin (E01 / DEC-089).
 *
 * iOS standalone PWAs — especially with the translucent status bar (`black-translucent`) — miscompute
 * `100dvh`/`%` on first paint and after rotation: the shell ends up SHORTER than the screen, which the
 * user sees as content crammed at the top and a black strip filling the bottom of the display. The
 * leva-1 safe-area audit (DEC-088) passed on desktop/simulator but missed this on a real iPhone.
 *
 * `window.innerHeight` is the reliable height in standalone (there is no browser chrome to subtract),
 * so we mirror it into a `--app-height` custom property and pin the shell (`.app`, `.ob`) and the
 * `html/body/#root` chain to it. The CSS keeps `100dvh`/`100%` as the fallback for the pre-JS first
 * paint and for environments where JS never runs.
 */
import { useEffect } from "react";

/** Write the measured visible height into `--app-height` (rounded px). Safe to call outside the DOM. */
export function applyAppHeight(px: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--app-height", `${Math.round(px)}px`);
}

/** Mount once at the app root: keep `--app-height` in sync with the real viewport on resize/rotation. */
export function useAppHeight(): void {
  useEffect(() => {
    const sync = () => applyAppHeight(window.innerHeight);
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
}
