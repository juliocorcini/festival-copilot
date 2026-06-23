/**
 * Day/night palette selection (DEC-034 §11.5). Both palettes ship with the map;
 * "auto" picks one by local time, and the user can override to Day or Night.
 */
import { useEffect, useState } from "react";

export type PaletteMode = "auto" | "day" | "night";
export type Palette = "day" | "night";

const isDaytime = (): boolean => {
  const h = new Date().getHours();
  return h >= 7 && h < 19;
};

export function usePalette(): {
  mode: PaletteMode;
  setMode: (m: PaletteMode) => void;
  palette: Palette;
} {
  const [mode, setMode] = useState<PaletteMode>("auto");
  const [, force] = useState(0);

  // Re-evaluate the auto rule once a minute so it flips at dusk/dawn on its own.
  useEffect(() => {
    if (mode !== "auto") return;
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const palette: Palette = mode === "auto" ? (isDaytime() ? "day" : "night") : mode;
  return { mode, setMode, palette };
}
