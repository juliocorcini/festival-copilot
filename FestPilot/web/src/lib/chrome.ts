/**
 * System-bar chrome (D11 / DEC-088). Keeps the PWA `theme-color` meta — the color the OS paints the
 * status bar (and, on some Androids, the navigation bar) with — in sync with the active appearance
 * palette, instead of the single hard-coded value in `index.html`.
 *
 * Today the app chrome is the same warm near-black in BOTH palettes (only the MAP raster swaps day vs
 * night), so both entries below resolve to the same token — which is exactly what makes the system bars
 * MATCH the header/nav on every screen. Driving it through a palette map (rather than a lone constant)
 * is the single switch-point for when a distinct day chrome ever lands, and lets the bar follow the
 * palette live via JS now.
 *
 * The native app shell (Capacitor `@capacitor/status-bar` + NavigationBar) is intentionally NOT built
 * here — FestPilot is a PWA (DEC-035). The plan for that future shell is documented in
 * `brain/documents/2026-06-27-native-system-bars.md`.
 */
import { useEffect } from "react";
import { useAppearance, type Palette } from "../app/settings";

/** The status-bar color per palette. Both are the warm near-black chrome base (`--bg`) for now. */
export const THEME_COLOR: Record<Palette, string> = {
  day: "#0F0D09",
  night: "#0F0D09",
};

/** Set (or create) the `<meta name="theme-color">` to match the given palette. Safe outside the DOM. */
export function applyThemeColor(palette: Palette): void {
  if (typeof document === "undefined") return;
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[palette];
}

/** Mount once at the app root: re-applies the palette's `theme-color` whenever the palette changes. */
export function useThemeColor(): void {
  const { palette } = useAppearance();
  useEffect(() => applyThemeColor(palette), [palette]);
}
