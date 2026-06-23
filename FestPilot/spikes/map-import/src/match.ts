// Auto-match imported point features to official lineup stages by normalized name,
// with a small alias table for known renames. Everything else is flagged for review.

import type { FeatureCategory, ImportedFeature, ImportedMapFeature, OfficialStage } from "./types.js";

const SPONSOR = /\bBY\s+[A-Z0-9' .&-]+$/; // "FREEDOM BY BUD", "MELODIA BY CORONA", "... BY JBL"

/** Normalize a stage name for matching: drop sponsor suffix, "STAGE", leading "THE", punctuation. */
export function normalizeName(s: string): string {
  return s
    .toUpperCase()
    .replace(/\bHOSTED\b.*$/, "")
    .replace(SPONSOR, "")
    .replace(/\bSTAGE\b/g, "")
    .replace(/^THE\s+/, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Renames the normalizer cannot infer on its own (old map name -> current official name).
const ALIASES: Record<string, string> = {
  LIBRARY: "THE GREAT LIBRARY", // KML "The Library" -> "THE GREAT LIBRARY"
};

const ENTRANCE = /(entrance|gate|exit)/i;

function classify(f: ImportedFeature, matched: boolean): FeatureCategory {
  if (f.geometry.type === "Polygon") return "area";
  if (f.geometry.type === "LineString") return "path";
  if (matched) return "stage";
  if (ENTRANCE.test(f.name)) return "entrance";
  return "poi";
}

export interface MatchOutcome {
  features: ImportedMapFeature[];
  officialUnplaced: OfficialStage[];
}

export function matchFeatures(features: ImportedFeature[], official: OfficialStage[]): MatchOutcome {
  const byNorm = new Map<string, OfficialStage>();
  for (const s of official) byNorm.set(normalizeName(s.name), s);

  const placed = new Set<string>();

  const result: ImportedMapFeature[] = features.map((f) => {
    let matchedStage: OfficialStage | undefined;
    let confidence: ImportedMapFeature["matchConfidence"] = null;

    if (f.geometry.type === "Point" && f.name) {
      const norm = normalizeName(f.name);
      const aliased = ALIASES[norm];
      const target = aliased ? normalizeName(aliased) : norm;
      matchedStage = byNorm.get(target);
      if (matchedStage) {
        confidence = aliased ? "medium" : norm === normalizeName(matchedStage.name) ? "high" : "medium";
        placed.add(matchedStage.id);
      }
    }

    const category = classify(f, !!matchedStage);
    const status: ImportedMapFeature["status"] = matchedStage
      ? "matched"
      : f.geometry.type === "Point" && !ENTRANCE.test(f.name)
        ? "needs_review" // a point that looks like a stage but didn't match (likely old/renamed)
        : "non_stage";

    return {
      ...f,
      category,
      matchedStageId: matchedStage?.id ?? null,
      matchedStageName: matchedStage?.name ?? null,
      matchConfidence: confidence,
      status,
    };
  });

  const officialUnplaced = official.filter((s) => !placed.has(s.id));
  return { features: result, officialUnplaced };
}
