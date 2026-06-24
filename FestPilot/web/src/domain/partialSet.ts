/**
 * Partial-set feasibility (DEC-018): you may leave a set early ("cut") to reach the next one.
 * A transition is feasible when you can depart `from` at `cutMs` and walk to `to` before it starts.
 */
import type { PlanSlot, TravelMatrix } from "./types";

export interface Transition {
  feasible: boolean;
  /** Minutes you must give up off the end of the `from` set to make it (0 if none). */
  cutMinutes: number;
  /** Walking minutes between the two stages. */
  walkMinutes: number;
  /** Idle minutes after arriving before `to` starts (>= 0 when feasible). */
  slackMinutes: number;
}

const MIN = 60_000;

/**
 * Evaluate moving from one locked slot to the next. `cutMs` is when you actually leave `from`
 * (defaults to its end). Feasible iff departure + walking time <= the next set's start.
 */
export function evaluateTransition(
  from: PlanSlot,
  to: PlanSlot,
  travel: TravelMatrix,
  cutMs?: number
): Transition {
  const walkMinutes = Math.max(0, travel.minutesBetween(from.stageId, to.stageId));
  const departMs = clamp(cutMs ?? from.endMs, from.startMs, from.endMs);
  const arriveMs = departMs + walkMinutes * MIN;
  const slackMs = to.startMs - arriveMs;
  return {
    feasible: slackMs >= 0,
    cutMinutes: Math.max(0, Math.round((from.endMs - departMs) / MIN)),
    walkMinutes,
    slackMinutes: Math.round(slackMs / MIN),
  };
}

/** Earliest cut (latest possible departure) off `from` that still reaches `to` in time, or null. */
export function latestFeasibleDeparture(from: PlanSlot, to: PlanSlot, travel: TravelMatrix): number | null {
  const walkMinutes = Math.max(0, travel.minutesBetween(from.stageId, to.stageId));
  const mustLeaveBy = to.startMs - walkMinutes * MIN;
  if (mustLeaveBy < from.startMs) return null;
  return Math.min(mustLeaveBy, from.endMs);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Flat-fee travel matrix used until the georeferenced map lands (Phase 3). */
export function flatTravelMatrix(minutes = 8): TravelMatrix {
  return {
    minutesBetween: (from, to) => (from && to && from === to ? 0 : minutes),
  };
}
