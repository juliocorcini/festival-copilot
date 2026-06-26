/**
 * Travel time & coord→stage (DEC-011/UC-11, Phase 3 G3.2). Walking minutes are auto-estimated from
 * the georeferenced stage coordinates (the same affine-published coords the map uses); the admin
 * manual-override matrix (B8.6) layers on top later. Pure + framework-free so it powers My Plan, the
 * Lock-in scissors and the Now&Next "leave by" identically, and is exhaustively unit-tested.
 */
import type { TravelMatrix } from "./types";

export interface LatLng {
  lat: number;
  lng: number;
}

const RAD = Math.PI / 180;
/** ~4 km/h through a packed festival — deliberately conservative so "leave by" never runs you late. */
const DEFAULT_METERS_PER_MINUTE = 67;
/** Unknown stage pair (no published coords) — matches the Phase-2 flat stub so nothing regresses. */
const DEFAULT_FALLBACK_MINUTES = 8;
/** Straight-line × this ≈ a real walking path around fences/crowds. */
const DEFAULT_DETOUR = 1.3;

/** Approximate metres between two coordinates (equirectangular — accurate at festival scale, ~1 km). */
export function metersBetween(a: LatLng, b: LatLng): number {
  const k = Math.cos(((a.lat + b.lat) / 2) * RAD);
  const dx = (b.lng - a.lng) * k;
  const dy = b.lat - a.lat;
  return Math.hypot(dx, dy) * 111320;
}

/**
 * Initial bearing from `from` to `to`, in degrees clockwise from true north (0 = N, 90 = E, 180 = S).
 * Powers the compass-arrow meeting-point navigation (Gate 6.3): the arrow rotation is this bearing
 * minus the device heading, so it points at the spot regardless of which way the phone faces.
 */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = from.lat * RAD;
  const lat2 = to.lat * RAD;
  const dLng = (to.lng - from.lng) * RAD;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

const COMPASS_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** The 8-point compass label for a bearing (0–360) — a plain "head NE" cue alongside the arrow. */
export function compassPoint(bearing: number): string {
  const i = Math.round(((bearing % 360) + 360) % 360 / 45) % 8;
  return COMPASS_POINTS[i];
}

export interface TravelMatrixOptions {
  metersPerMinute?: number;
  fallbackMinutes?: number;
  detour?: number;
  minMinutes?: number;
  /**
   * Operator-curated walking minutes for specific directed pairs (DEC-065), keyed `"fromId|toId"`.
   * A present pair wins over the coord estimate — the admin knows the real path around fences/crowds.
   */
  overrides?: ReadonlyMap<string, number>;
}

/** Key for the override map — a directed stage pair. */
export function travelPairKey(fromStageId: string, toStageId: string): string {
  return `${fromStageId}|${toStageId}`;
}

/**
 * A `TravelMatrix` keyed by stage id. Same stage → 0; an operator override for the pair wins; else a
 * pair with coords → distance/​speed (rounded up, floored at `minMinutes`); a pair missing both → fallback.
 */
export function buildTravelMatrix(coords: ReadonlyMap<string, LatLng>, options: TravelMatrixOptions = {}): TravelMatrix {
  const metersPerMinute = options.metersPerMinute ?? DEFAULT_METERS_PER_MINUTE;
  const fallbackMinutes = options.fallbackMinutes ?? DEFAULT_FALLBACK_MINUTES;
  const detour = options.detour ?? DEFAULT_DETOUR;
  const minMinutes = options.minMinutes ?? 2;
  const overrides = options.overrides;
  return {
    minutesBetween(fromStageId, toStageId) {
      if (fromStageId && toStageId && fromStageId === toStageId) return 0;
      if (overrides && fromStageId && toStageId) {
        const stored = overrides.get(travelPairKey(fromStageId, toStageId));
        if (stored != null && Number.isFinite(stored)) return stored;
      }
      const a = fromStageId ? coords.get(fromStageId) : undefined;
      const b = toStageId ? coords.get(toStageId) : undefined;
      if (!a || !b) return fallbackMinutes;
      const meters = metersBetween(a, b) * detour;
      return Math.max(minMinutes, Math.round(meters / metersPerMinute));
    },
  };
}

export type StageConfidence = "high" | "medium" | "low";

export interface CoordStageHit {
  stageId: string;
  meters: number;
  confidence: StageConfidence;
}

export interface CoordToStageOptions {
  /** Inside this radius of a stage → you're "at" it (high confidence). */
  radiusMeters?: number;
}

/**
 * coord→stage (UC-11): circle-area hit (within `radiusMeters`) → HIGH; otherwise the nearest stage
 * with a distance-tiered confidence. Returns null only when there are no stages with coordinates.
 */
export function coordToStage(point: LatLng, coords: ReadonlyMap<string, LatLng>, options: CoordToStageOptions = {}): CoordStageHit | null {
  const radius = options.radiusMeters ?? 70;
  let bestId: string | null = null;
  let bestMeters = Number.POSITIVE_INFINITY;
  for (const [id, coord] of coords) {
    const meters = metersBetween(point, coord);
    if (meters < bestMeters) {
      bestMeters = meters;
      bestId = id;
    }
  }
  if (bestId == null) return null;
  const confidence: StageConfidence = bestMeters <= radius ? "high" : bestMeters <= radius * 3 ? "medium" : "low";
  return { stageId: bestId, meters: Math.round(bestMeters), confidence };
}
