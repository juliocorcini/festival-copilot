/**
 * Persisted app settings — the single source of truth for appearance + language
 * (DEC-034 day/night, DEC-039 Q-K English default). Backed by localStorage and
 * synced across all consumers (map palette, theme, copy) via a custom event.
 */
import { useEffect, useState } from "react";

export type AppearanceMode = "auto" | "day" | "night";
export type Palette = "day" | "night";
export type Language = "en" | "pt";

const KEYS = { appearance: "fp.appearance", language: "fp.language" } as const;
const SETTING_EVENT = "fp:setting";

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable (private mode); in-memory state still updates */
  }
  window.dispatchEvent(new CustomEvent(SETTING_EVENT, { detail: { key } }));
}

function useSetting(key: string, fallback: string): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(() => read(key, fallback));
  useEffect(() => {
    const sync = (): void => setValue(read(key, fallback));
    window.addEventListener(SETTING_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SETTING_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [key, fallback]);
  const set = (next: string): void => {
    write(key, next);
    setValue(next);
  };
  return [value, set];
}

const isDaytime = (): boolean => {
  const h = new Date().getHours();
  return h >= 7 && h < 19;
};

export function useAppearance(): {
  mode: AppearanceMode;
  setMode: (mode: AppearanceMode) => void;
  palette: Palette;
} {
  const [mode, setMode] = useSetting(KEYS.appearance, "auto");
  const [, force] = useState(0);

  useEffect(() => {
    if (mode !== "auto") return;
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const palette: Palette = mode === "auto" ? (isDaytime() ? "day" : "night") : (mode as Palette);
  return { mode: mode as AppearanceMode, setMode: (m) => setMode(m), palette };
}

export function useLanguage(): { language: Language; setLanguage: (language: Language) => void } {
  const [language, setLanguage] = useSetting(KEYS.language, "en");
  return { language: language as Language, setLanguage: (l) => setLanguage(l) };
}
