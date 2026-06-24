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

// --- Lifecycle (Gate 6.2, UC-28, wireframe #26.3/#26.4) -------------------------------------------
// The persisted `meeting_point.status` is intentionally coarse (active / archived / cancelled); the
// rich, time-sensitive state the squad sees is DERIVED at read time from the responders + expiry +
// now, so it stays honest as people respond and the clock moves — no extra writes, no schema change.

/** The state a meeting point presents to the squad (computed, never stored). */
export type MeetingLifecycle =
  | "active" // just dropped — only the creator is committed so far
  | "on_the_way" // people are heading over (someone's here, or ≥2 committed)
  | "everyone_here" // every committed member made it — the reunion moment (#26.4)
  | "expiring_soon" // inside the final window before auto-close
  | "expired" // past its grace window (or archived) — auto-faded
  | "cancelled"; // the creator called it off

/** Inside this window before expiry → "expiring_soon" (a gentle "closing" nudge). */
export const EXPIRING_SOON_MS = 5 * 60_000;
/** The creator's live fix being further than this from the spot → a "you've drifted" prompt. */
export const DRIFT_RADIUS_M = 250;
/** Walk model shared with domain/travel.ts: ~4 km/h through a packed festival, ×1.3 for the real path. */
const WALK_METERS_PER_MIN = 67;
const WALK_DETOUR = 1.3;

export interface LifecycleInput {
  /** The persisted coarse status: active / archived / cancelled. */
  dbStatus: string;
  expiresAtMs: number;
  nowMs: number;
  /** Members heading over (status = going). */
  onTheWayCount: number;
  /** Members who arrived (status = arrived). */
  hereCount: number;
}

/**
 * Derive the live lifecycle state (pure, exhaustively unit-tested). Order matters: a cancelled or
 * expired point is terminal; otherwise "everyone's here" wins over the time-based and progress
 * states. "everyone_here" needs ≥2 committed members so a solo creator never triggers the reunion.
 */
export function meetingLifecycle(input: LifecycleInput): MeetingLifecycle {
  if (input.dbStatus === "cancelled") return "cancelled";
  if (input.dbStatus === "archived" || input.nowMs >= input.expiresAtMs) return "expired";
  const committed = input.onTheWayCount + input.hereCount;
  if (committed >= 2 && input.hereCount === committed) return "everyone_here";
  if (input.expiresAtMs - input.nowMs <= EXPIRING_SOON_MS) return "expiring_soon";
  if (input.hereCount >= 1 || input.onTheWayCount >= 2) return "on_the_way";
  return "active";
}

/** Whether a derived lifecycle state still counts the point as "live" (shown on the squad home). */
export function isLiveLifecycle(state: MeetingLifecycle): boolean {
  return state !== "expired" && state !== "cancelled";
}

/**
 * Walking ETA in minutes from the straight-line metres between a member and the spot — the same
 * conservative model My Plan / Now&Next use. Floored at 1 min so "here-ish" never reads "0 min".
 * Returns a count of minutes; the caller decides whether to expose it (only for sharing members).
 */
export function walkEtaMinutes(straightMeters: number): number {
  return Math.max(1, Math.round((straightMeters * WALK_DETOUR) / WALK_METERS_PER_MIN));
}

/** A gentle "you've drifted from the spot" prompt for the creator (null distance = unknown → false). */
export function creatorDrifted(creatorDistanceMeters: number | null): boolean {
  return creatorDistanceMeters != null && creatorDistanceMeters > DRIFT_RADIUS_M;
}
