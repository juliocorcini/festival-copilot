/**
 * Now & Next model (#18, UC-12/DEC-022): from the day's locked plan it derives what's on now, what's
 * next, and — the headline feature — *when to leave* to walk to the next set in time. Pure over a
 * `TravelMatrix` so the home, My Plan and the reminder job agree on the math. No DOM/React.
 */
import { evaluateTransition } from "./partialSet";
import type { PlanSlot, TravelMatrix } from "./types";

const MIN = 60_000;

export interface NowNextModel {
  /** The set happening now (start ≤ now < effective end), or null. */
  live: PlanSlot | null;
  /** The next set after now, or null when the day is over. */
  next: PlanSlot | null;
  /** Whole-minute walk from the live (or previous) stage to `next`'s stage. */
  walkMinutes: number;
  /**
   * Minutes until you must leave to reach `next` on time (start − walk − now). Can be negative
   * (you're already late) — the UI clamps/colors it. Null when there's no `next`.
   */
  leaveInMinutes: number | null;
  /** Elapsed fraction of the live set [0..1] (0 when nothing is live). */
  progress: number;
  /** Upcoming sets after `next` (for "later tonight"). */
  later: PlanSlot[];
}

function effectiveEnd(slot: PlanSlot): number {
  return slot.cutMs != null && slot.cutMs > slot.startMs && slot.cutMs < slot.endMs ? slot.cutMs : slot.endMs;
}

/** Build the Now&Next model for a single day's locked slots at instant `nowMs`. */
export function buildNowNext(slots: PlanSlot[], travel: TravelMatrix, nowMs: number): NowNextModel {
  const ordered = [...slots].sort((a, b) => a.startMs - b.startMs);
  const live = ordered.find((s) => s.startMs <= nowMs && nowMs < effectiveEnd(s)) ?? null;
  const next = ordered.find((s) => s.startMs > nowMs) ?? null;

  let walkMinutes = 0;
  let leaveInMinutes: number | null = null;
  if (next) {
    // Walk origin: the set you're at now, else the most recent one you've left.
    const origin = live ?? [...ordered].reverse().find((s) => effectiveEnd(s) <= nowMs) ?? null;
    const transition = origin
      ? evaluateTransition(origin, next, travel, live ? undefined : effectiveEnd(origin))
      : { walkMinutes: 0 };
    walkMinutes = transition.walkMinutes;
    leaveInMinutes = Math.round((next.startMs - walkMinutes * MIN - nowMs) / MIN);
  }

  const progress = live ? clamp01((nowMs - live.startMs) / Math.max(1, effectiveEnd(live) - live.startMs)) : 0;
  const later = next ? ordered.filter((s) => s.startMs > next.startMs) : [];

  return { live, next, walkMinutes, leaveInMinutes, progress, later };
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
