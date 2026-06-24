/**
 * Festival day = a derived contiguous block, not the source `day` label nor the civil date (DEC-048).
 *
 * The source labels some after-midnight sets by civil date (a Friday-night 00:30 set can carry
 * "SATURDAY"), and occasionally mis-tags a stray set entirely. Grouping by the raw label therefore
 * leaks late sets into the wrong night and blows up the timetable window. Instead we sort every timed
 * set and split into blocks wherever a real gap (≥ `gapHours`, on every stage) appears: one block = one
 * festival night, so a 00:30 set stays with the Friday it belongs to and the window crosses midnight.
 *
 * The block `id` is the plurality of the block's source `day` labels (e.g. "FRIDAY"). That keeps it
 * equal to the existing day key so persisted plans/onboarding selections (planKey is `${festivalId}:${id}`)
 * survive the regrouping untouched, while a single mis-tagged set is outvoted and pulled into the
 * correct night by time. Pure, no DOM/React — unit-tested with concrete numbers.
 */
import type { PerformanceDto } from "../data/types";

const HOUR_MS = 3_600_000;
const DEFAULT_GAP_HOURS = 3;

export interface FestivalDay {
  /** Stable key — plurality of the block's source `day` labels (e.g. "FRIDAY"). Matches the persisted day key. */
  id: string;
  /** Plurality weekend of the block (blocks never straddle weekends — the gap between them is days). */
  weekendId: string | null;
  /** Block window start — the first set's start (ms). */
  startMs: number;
  /** Block window end — the latest set's end (ms); crosses midnight when the night does. */
  endMs: number;
  /** Performance ids in this block — the membership the timetable filters by. */
  performanceIds: string[];
}

interface TimedPerformance {
  id: string;
  day: string | null;
  weekendId: string | null;
  startMs: number;
  endMs: number;
}

/** Plannable, timed performances sorted by start. End is clamped to ≥ start so partial data never inverts. */
function timedPerformances(performances: PerformanceDto[]): TimedPerformance[] {
  const timed: TimedPerformance[] = [];
  for (const performance of performances) {
    if (performance.isPlaceholder) continue;
    if (!performance.startAtUtc) continue;
    const startMs = Date.parse(performance.startAtUtc);
    if (!Number.isFinite(startMs)) continue;
    const rawEnd = performance.endAtUtc ? Date.parse(performance.endAtUtc) : NaN;
    const endMs = Number.isFinite(rawEnd) && rawEnd > startMs ? rawEnd : startMs;
    timed.push({ id: performance.id, day: performance.day, weekendId: performance.weekendId, startMs, endMs });
  }
  return timed.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
}

function plurality(counts: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = -1;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Split performances into contiguous festival-day blocks. A new block starts when the next set begins
 * `gapHours`+ after the running max-end of the current block (i.e. a real lull across all stages).
 */
export function assignFestivalDays(performances: PerformanceDto[], gapHours = DEFAULT_GAP_HOURS): FestivalDay[] {
  const gapMs = gapHours * HOUR_MS;
  const timed = timedPerformances(performances);

  const blocks: TimedPerformance[][] = [];
  let current: TimedPerformance[] = [];
  let runningEnd = Number.NEGATIVE_INFINITY;

  for (const performance of timed) {
    if (current.length === 0) {
      current = [performance];
      runningEnd = performance.endMs;
      continue;
    }
    if (performance.startMs - runningEnd >= gapMs) {
      blocks.push(current);
      current = [performance];
      runningEnd = performance.endMs;
    } else {
      current.push(performance);
      if (performance.endMs > runningEnd) runningEnd = performance.endMs;
    }
  }
  if (current.length > 0) blocks.push(current);

  return blocks.map((block) => {
    const dayCounts = new Map<string, number>();
    const weekendCounts = new Map<string, number>();
    const performanceIds: string[] = [];
    let endMs = Number.NEGATIVE_INFINITY;
    for (const performance of block) {
      performanceIds.push(performance.id);
      if (performance.endMs > endMs) endMs = performance.endMs;
      if (performance.day) dayCounts.set(performance.day, (dayCounts.get(performance.day) ?? 0) + 1);
      if (performance.weekendId) {
        weekendCounts.set(performance.weekendId, (weekendCounts.get(performance.weekendId) ?? 0) + 1);
      }
    }
    const startMs = block[0]!.startMs;
    const id = plurality(dayCounts) ?? block[0]!.day ?? `day-${startMs}`;
    return { id, weekendId: plurality(weekendCounts) ?? block[0]!.weekendId, startMs, endMs, performanceIds };
  });
}

/** Map every plannable performance id to its festival-day id — the single grouping source for the UI. */
export function festivalDayIdByPerformanceId(
  performances: PerformanceDto[],
  gapHours = DEFAULT_GAP_HOURS
): Map<string, string> {
  const byId = new Map<string, string>();
  for (const day of assignFestivalDays(performances, gapHours)) {
    for (const performanceId of day.performanceIds) byId.set(performanceId, day.id);
  }
  return byId;
}
