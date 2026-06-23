// Types for the map-import spike (KML seed -> ImportedMapFeature -> StageLocation/Poi).
// Mirrors the shapes sketched in brain/technical-direction.md §4 + research map-seed doc.

export type GeometryType = "Point" | "Polygon" | "LineString";

export type Geometry =
  | { type: "Point"; coordinates: [number, number] } // [lng, lat]
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "LineString"; coordinates: [number, number][] };

export interface ImportedFeature {
  id: string;
  name: string;
  description: string | null;
  layer: string | null;
  geometry: Geometry;
}

export type FeatureCategory = "stage" | "entrance" | "area" | "path" | "poi";
export type MatchStatus = "matched" | "needs_review" | "non_stage";
export type Confidence = "high" | "medium" | "low";

export interface OfficialStage {
  id: string;
  name: string;
}

export interface ImportedMapFeature extends ImportedFeature {
  category: FeatureCategory;
  matchedStageId: string | null;
  matchedStageName: string | null;
  matchConfidence: Confidence | null;
  status: MatchStatus;
}
