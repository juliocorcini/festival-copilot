/** Interval math for clash detection. Touching endpoints (end == next start) do NOT overlap. */
import type { PlannableSet } from "./types";

export function overlaps(a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs;
}

/** Chronological sort by start, then by end (stable tie-break for determinism). */
export function byStart(a: PlannableSet, b: PlannableSet): number {
  return a.startMs - b.startMs || a.endMs - b.endMs || a.id.localeCompare(b.id);
}

/**
 * Group sets into chain-overlap clusters (a "clash" is a maximal run where each set overlaps
 * the running merged interval). Clusters are returned in chronological order; a size-1 cluster
 * means no clash. Pure: does not mutate the input.
 */
export function clusterByOverlap(sets: PlannableSet[]): PlannableSet[][] {
  const sorted = [...sets].sort(byStart);
  const clusters: PlannableSet[][] = [];
  let current: PlannableSet[] = [];
  let runningEnd = -Infinity;

  for (const set of sorted) {
    if (current.length === 0 || set.startMs < runningEnd) {
      current.push(set);
      runningEnd = Math.max(runningEnd, set.endMs);
    } else {
      clusters.push(current);
      current = [set];
      runningEnd = set.endMs;
    }
  }
  if (current.length > 0) clusters.push(current);
  return clusters;
}

/** True iff a chronologically-sorted slot list has zero overlaps (the plan invariant, DEC-017). */
export function hasNoOverlaps(slots: { startMs: number; endMs: number }[]): boolean {
  const sorted = [...slots].sort((a, b) => a.startMs - b.startMs);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.startMs < sorted[i - 1]!.endMs) return false;
  }
  return true;
}
