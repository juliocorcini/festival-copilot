/**
 * Presentation metadata for points of interest (DEC-065). Data-driven (one entry per type) so the
 * user map, the legend/filter and the admin editor all read the same glyph + label + colour and
 * never drift. Emoji glyphs render crisply in both SVG <text> and HTML across browsers — no icon-font
 * ligature fragility — which keeps the map markers screen-stable at any zoom.
 */
import { POI_TYPES, type PoiType } from "../data/types";

export interface PoiMeta {
  label: string;
  glyph: string;
  color: string;
}

export const POI_META: Record<PoiType, PoiMeta> = {
  toilet: { label: "Toilets", glyph: "🚻", color: "#5b8def" },
  water: { label: "Water", glyph: "💧", color: "#38bdf8" },
  food: { label: "Food & drink", glyph: "🍔", color: "#f59e0b" },
  medical: { label: "Medical", glyph: "⛑️", color: "#ef4444" },
  exit: { label: "Exits", glyph: "🚪", color: "#94a3b8" },
  atm: { label: "ATM", glyph: "🏧", color: "#22c55e" },
  charging: { label: "Charging", glyph: "🔌", color: "#a78bfa" },
  locker: { label: "Lockers", glyph: "🔐", color: "#eab308" },
  entrance: { label: "Entrance", glyph: "🎟️", color: "#ec4899" },
  landmark: { label: "Landmark", glyph: "📍", color: "#f472b6" },
};

/** The ordered type list for editor pickers + legends (mirrors the registry order). */
export const POI_TYPE_ORDER: readonly PoiType[] = POI_TYPES;

export function poiMeta(type: PoiType): PoiMeta {
  return POI_META[type] ?? POI_META.landmark;
}
