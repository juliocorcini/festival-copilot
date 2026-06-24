/** Small presentation helpers: stage colors + festival-timezone time formatting. */

const STAGE_PALETTE = [
  "var(--s-main)",
  "var(--s-free)",
  "var(--s-core)",
  "var(--s-cage)",
  "var(--s-elix)",
  "var(--s-rose)",
];

const KNOWN_STAGE_COLORS: Record<string, string> = {
  MAINSTAGE: "var(--s-main)",
  CORE: "var(--s-core)",
  CAGE: "var(--s-cage)",
  ELIXIR: "var(--s-elix)",
};

/** Resolved hex for each design-system stage token, so colors can also be expressed as `r,g,b`. */
const TOKEN_HEX: Record<string, string> = {
  "var(--s-main)": "#ff5a36",
  "var(--s-core)": "#16a34a",
  "var(--s-free)": "#0ea5e9",
  "var(--s-cage)": "#f59e0b",
  "var(--s-elix)": "#7c3aed",
  "var(--s-rose)": "#ec4899",
  "var(--muted)": "#9c9080",
};

/** Deterministic per-stage color: known stages map to brand tokens, the rest hash into the palette. */
export function stageColor(stageName: string | null | undefined): string {
  if (!stageName) return "var(--muted)";
  const key = stageName.trim().toUpperCase();
  for (const known of Object.keys(KNOWN_STAGE_COLORS)) {
    if (key.includes(known)) return KNOWN_STAGE_COLORS[known]!;
  }
  if (key.includes("FREEDOM")) return "var(--s-free)";
  if (key.includes("ROSE")) return "var(--s-rose)";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return STAGE_PALETTE[hash % STAGE_PALETTE.length]!;
}

/** The same deterministic stage color as `"r, g, b"`, for `rgba(var(--c), a)` recipes (timetable cards). */
export function stageColorRgb(stageName: string | null | undefined): string {
  const hex = TOKEN_HEX[stageColor(stageName)] ?? TOKEN_HEX["var(--muted)"]!;
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** "HH:mm" in the festival timezone (handles the UTC→local offset correctly). */
export function timeInZone(utcIso: string | null, timeZone: string): string {
  if (!utcIso) return "--:--";
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date);
}

/** "SAT 18 JUL" style label in the festival timezone. */
export function dayLabel(utcIso: string | null, timeZone: string): string {
  if (!utcIso) return "";
  const date = new Date(utcIso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  })
    .format(date)
    .toUpperCase();
}

/** Whole days from now until a future instant (0 if past/now). */
export function daysUntil(utcIso: string | null): number {
  if (!utcIso) return 0;
  const target = new Date(utcIso).getTime();
  if (Number.isNaN(target)) return 0;
  const diffMs = target - Date.now();
  return diffMs <= 0 ? 0 : Math.ceil(diffMs / 86_400_000);
}
