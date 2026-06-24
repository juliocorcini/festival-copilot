// Coarse presence resolution (Pillar 3b, Phase 5 — DEC-007/008/046). PURE + framework-free so the
// privacy-critical "raw fix -> coarse label" step is exhaustively unit-testable and identical on
// every code path. The server NEVER returns raw lat/lng to clients (DEC-015); this module turns a
// raw point into the only thing a client may ever see: a stage + an honest coarse label, confidence
// and a "between A and B" pair. Distances use the same equirectangular metric as domain/travel.ts
// (accurate at festival scale, ~1 km).

export type CoarseLabel = "at" | "near" | "between" | "none";
export type PresenceConfidence = "high" | "medium" | "low";

export interface StageCoord {
  stageId: string;
  lat: number;
  lng: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** The coarse result — the maximal information a client is ever allowed to receive about presence. */
export interface CoarsePresence {
  stageId: string | null;
  /** The second stage for a "between A and B" reading; null otherwise. */
  betweenStageId: string | null;
  coarseLabel: CoarseLabel;
  confidence: PresenceConfidence;
  /** Distance (m) to the resolved stage — SERVER-SIDE diagnostics only; never sent to clients. */
  meters: number | null;
}

const RAD = Math.PI / 180;

/** Inside this radius of a stage → "at STAGE" (high confidence). */
export const AT_RADIUS_M = 70;
/** Clearly closest to one stage within this range → "near STAGE" (medium). */
export const NEAR_RADIUS_M = 220;
/** No-man's-land between two comparable stages, both within this range → "between A and B" (low). */
export const BETWEEN_MAX_M = 450;
/** Beyond `NEAR_RADIUS_M` but within this → still "near" but only low confidence. */
export const FAR_NEAR_M = 700;
/** A poor GPS fix (accuracy worse than this) caps an "at" reading down to medium confidence. */
export const POOR_ACCURACY_M = 50;

/** Approximate metres between two coordinates (equirectangular — accurate at festival scale). */
export function metersBetween(a: LatLng, b: LatLng): number {
  const k = Math.cos(((a.lat + b.lat) / 2) * RAD);
  const dx = (b.lng - a.lng) * k;
  const dy = b.lat - a.lat;
  return Math.hypot(dx, dy) * 111320;
}

/**
 * Turn a raw fix into a coarse, honest presence reading (UC-22, DEC-007/008).
 *   - within AT_RADIUS of the nearest stage      → "at" (high; medium if the fix is poor)
 *   - clearly closest to one stage (<= NEAR)     → "near" (medium)
 *   - between two comparable stages (<= BETWEEN) → "between A and B" (low)
 *   - still within FAR_NEAR of a stage           → "near" (low)
 *   - otherwise / no stages with coords          → "none"
 * The "second" stage for a between reading is the next-nearest within ~1.5x the nearest distance.
 */
export function coarsenPresence(
  point: LatLng,
  stages: readonly StageCoord[],
  accuracyMeters?: number | null
): CoarsePresence {
  if (stages.length === 0) {
    return { stageId: null, betweenStageId: null, coarseLabel: "none", confidence: "low", meters: null };
  }

  const ranked = stages
    .map((s) => ({ s, m: metersBetween(point, s) }))
    .sort((a, b) => a.m - b.m);
  const nearest = ranked[0]!;
  const second = ranked[1];
  const meters = Math.round(nearest.m);

  if (nearest.m <= AT_RADIUS_M) {
    const poor = typeof accuracyMeters === "number" && accuracyMeters > POOR_ACCURACY_M;
    return {
      stageId: nearest.s.stageId,
      betweenStageId: null,
      coarseLabel: "at",
      confidence: poor ? "medium" : "high",
      meters,
    };
  }

  // Genuine ambiguity between two comparable stages beats a single "near" reading: if the
  // next-nearest stage is within ~1.5x the nearest distance (and we're not "at" either), it's
  // honest to say "between A and B" rather than implying you're clearly at one of them.
  if (second && nearest.m <= BETWEEN_MAX_M && second.m <= nearest.m * 1.5) {
    return {
      stageId: nearest.s.stageId,
      betweenStageId: second.s.stageId,
      coarseLabel: "between",
      confidence: "low",
      meters,
    };
  }

  if (nearest.m <= NEAR_RADIUS_M) {
    return { stageId: nearest.s.stageId, betweenStageId: null, coarseLabel: "near", confidence: "medium", meters };
  }

  if (nearest.m <= FAR_NEAR_M) {
    return { stageId: nearest.s.stageId, betweenStageId: null, coarseLabel: "near", confidence: "low", meters };
  }

  return { stageId: null, betweenStageId: null, coarseLabel: "none", confidence: "low", meters };
}

/** Freshness windows (DEC-008): a GPS fix is trusted ~15 min; a manual/push reply ~45 min. */
export type PresenceSource = "gps" | "manual" | "push_reply";

export const EXPIRY_MINUTES: Record<PresenceSource, number> = {
  gps: 15,
  manual: 45,
  push_reply: 45,
};

/** When a fix from `source` taken at `nowMs` should stop being shown as current. */
export function presenceExpiry(source: PresenceSource, nowMs: number): number {
  return nowMs + EXPIRY_MINUTES[source] * 60_000;
}
