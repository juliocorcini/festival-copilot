/**
 * What's on at a single stage, across the *whole* lineup (not the user's plan) — the payload of the
 * map's stage info sheet (DEC-050 / R2.2). Pure over PlannableSet[] so it's unit-testable with concrete
 * instants; the map layer supplies geometry (geoToSvg) and the squad-here roster (presence) separately.
 */
import type { PlannableSet } from "./types";

export interface StageProgramme {
  /** The set on now (start ≤ now < end) at this stage, or null. */
  now: PlannableSet | null;
  /** The next set to start at this stage after `now`, or null when the stage is done for the day. */
  next: PlannableSet | null;
}

/** Sets at one stage matched case-insensitively (map labels and lineup names can differ in case). */
export function setsAtStage(sets: PlannableSet[], stageName: string): PlannableSet[] {
  const key = stageName.trim().toUpperCase();
  return sets.filter((s) => s.stageName.trim().toUpperCase() === key).sort((a, b) => a.startMs - b.startMs);
}

/** Now-playing + next at a stage at instant `nowMs`. */
export function stageProgrammeAt(sets: PlannableSet[], stageName: string, nowMs: number): StageProgramme {
  const ordered = setsAtStage(sets, stageName);
  const now = ordered.find((s) => s.startMs <= nowMs && nowMs < s.endMs) ?? null;
  const next = ordered.find((s) => s.startMs > nowMs) ?? null;
  return { now, next };
}
