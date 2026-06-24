// Meeting-point domain (Pillar 3b, Phase 6 — UC-27, DEC-014). PURE + framework-free. A meeting
// point carries an EXACT coordinate (the creator's explicit opt-in share, DEC-046), but the squad
// also wants a human landmark for it ("at FREEDOM" / "between FREEDOM & CORE"). We reuse the same
// coarse reading the presence pipeline produces (domain/presence.ts), then name the stages here so
// the labelling rule lives in one tested place and never leaks raw coordinates into copy.

import type { CoarsePresence } from "./presence";

// Lifecycle (DEC-014, wireframe #26.4): a point auto-closes a grace window AFTER its meet time
// ("auto-closes 30 min after the time"). The create UI picks only *when* to meet; expiry is derived
// as meet-time + grace, so a future "In 30 min" point stays alive long enough for the squad to land.
export const DEFAULT_GRACE_MIN = 30;
const MIN_GRACE_MIN = 10;
const MAX_GRACE_MIN = 240;

/** Clamp an optional grace window to a sane range (defends the POST body); default 30. */
export function clampGraceMinutes(minutes: number | null | undefined): number {
  if (typeof minutes !== "number" || !Number.isFinite(minutes)) return DEFAULT_GRACE_MIN;
  return Math.min(MAX_GRACE_MIN, Math.max(MIN_GRACE_MIN, Math.round(minutes)));
}

/**
 * When a point should auto-close: a grace window after the meet time (or after "now" for a
 * meet-now point). Pure so the lifecycle rule is unit-tested in one place.
 */
export function meetingExpiry(meetAtMs: number | null, nowMs: number, graceMinutes: number): number {
  const base = meetAtMs != null && meetAtMs > nowMs ? meetAtMs : nowMs;
  return base + graceMinutes * 60_000;
}

/**
 * A human landmark label for a meeting point from its coarse reading + a stage-name lookup.
 *   - "at FREEDOM"            (inside a stage)
 *   - "near FREEDOM"          (clearly closest to one)
 *   - "between FREEDOM & CORE"(genuinely between two)
 *   - "in the venue"          (no nearby named stage / no map)
 * Never returns or implies a coordinate (DEC-015).
 */
export function landmarkLabel(coarse: CoarsePresence, nameById: ReadonlyMap<string, string>): string {
  const primary = coarse.stageId ? nameById.get(coarse.stageId) ?? null : null;
  const second = coarse.betweenStageId ? nameById.get(coarse.betweenStageId) ?? null : null;
  switch (coarse.coarseLabel) {
    case "at":
      return primary ? `at ${primary}` : "in the venue";
    case "between":
      return primary && second ? `between ${primary} & ${second}` : primary ? `near ${primary}` : "in the venue";
    case "near":
      return primary ? `near ${primary}` : "in the venue";
    default:
      return "in the venue";
  }
}
