/**
 * Per-day grouping for the favorites picker (R5.3). Acts are grouped by the derived festival-day
 * block (DEC-048): each act appears once, under the earliest in-scope day it plays — preserving the
 * dedup-across-days rule (DEC-026/028) — and the swipe deck advances day by day with per-day
 * progress ("Day 1 of 3 · 70%").
 */
import type { Act } from "./lineup";

export interface DayGroup {
  dayIndex: number;
  start: number;
  count: number;
}

/** Earliest in-scope day index an act plays; acts with no in-scope day sort last. */
export function actDayIndex(act: Act, dayKeyToIndex: ReadonlyMap<string, number>): number {
  let best = Number.POSITIVE_INFINITY;
  for (const key of act.days) {
    const i = dayKeyToIndex.get(key);
    if (i !== undefined && i < best) best = i;
  }
  return Number.isFinite(best) ? best : dayKeyToIndex.size;
}

/**
 * Order acts into contiguous per-day blocks (each act once, earliest day first), alphabetical
 * within a day. `dayKeys` is the ordered list of in-scope festival-day ids.
 */
export function groupActsByDay(acts: Act[], dayKeys: string[]): { orderedActs: Act[]; groups: DayGroup[] } {
  const dayKeyToIndex = new Map(dayKeys.map((key, i) => [key, i]));
  const orderedActs = [...acts].sort((a, b) => {
    const da = actDayIndex(a, dayKeyToIndex);
    const db = actDayIndex(b, dayKeyToIndex);
    if (da !== db) return da - db;
    return a.label.localeCompare(b.label);
  });
  const groups: DayGroup[] = [];
  orderedActs.forEach((act, i) => {
    const dayIndex = actDayIndex(act, dayKeyToIndex);
    const last = groups[groups.length - 1];
    if (last && last.dayIndex === dayIndex) last.count++;
    else groups.push({ dayIndex, start: i, count: 1 });
  });
  return { orderedActs, groups };
}

export interface DayProgress {
  ordinal: number;
  totalDays: number;
  dayIndex: number;
  withinDay: number;
  dayCount: number;
  pct: number;
}

/** Per-day progress at a swipe position; clamps to the last day when the deck is finished. */
export function dayProgressAt(groups: DayGroup[], index: number): DayProgress | null {
  if (groups.length === 0) return null;
  let gi = groups.findIndex((g) => index < g.start + g.count);
  if (gi === -1) gi = groups.length - 1;
  const group = groups[gi]!;
  const withinDay = Math.max(0, Math.min(index - group.start, group.count));
  const pct = group.count > 0 ? Math.round((withinDay / group.count) * 100) : 100;
  return { ordinal: gi + 1, totalDays: groups.length, dayIndex: group.dayIndex, withinDay, dayCount: group.count, pct };
}
