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

/**
 * A normalized set for the home hero — works for both a locked plan slot and a favorited
 * performance, so Now & Next can render one consistent hero regardless of source (DEC-022/R6).
 */
export interface HomeSet {
  id: string;
  actKey: string;
  label: string;
  stageName: string;
  startMs: number;
  endMs: number;
  imageUrl: string | null;
}

export interface HomeChrono {
  /** The set on now (start ≤ now < end), or null. */
  live: HomeSet | null;
  /** What the hero should show: the live set, else the next upcoming one, else null. */
  hero: HomeSet | null;
  /** The set after the hero (for "next up"/"then"), or null. */
  next: HomeSet | null;
  /** Sets after the hero, capped (for "later tonight"/"up next"). */
  later: HomeSet[];
}

/**
 * Chronological now/next/later over a set of favorites (R6): never arbitrary — only the user's own
 * picks, ordered by start. Pure so the home, tests and any future reminder agree on the math.
 */
export function chronoNowNext(sets: HomeSet[], nowMs: number, laterLimit = 6): HomeChrono {
  const ordered = [...sets].sort((a, b) => a.startMs - b.startMs);
  const live = ordered.find((s) => s.startMs <= nowMs && nowMs < s.endMs) ?? null;
  const upcoming = ordered.filter((s) => s.startMs > nowMs);
  const hero = live ?? upcoming[0] ?? null;
  const after = hero ? ordered.filter((s) => s.startMs > hero.startMs) : [];
  return { live, hero, next: after[0] ?? null, later: after.slice(0, laterLimit) };
}
