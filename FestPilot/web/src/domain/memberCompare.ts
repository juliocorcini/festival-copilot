/**
 * Pure domain logic for 1-on-1 member comparison (F17 / DEC-115).
 * Given two members' performance picks for a day, classifies each set into:
 * - "both" (overlap — you and them chose the same set)
 * - "only_you" (you chose it, they didn't)
 * - "only_them" (they chose it, you didn't)
 *
 * Also produces aggregate stats and a timeline-ordered result for the UI.
 * Framework-free, unit-testable with concrete data.
 */
import type { PlannableSet } from "./types";

export type OverlapKind = "both" | "only_you" | "only_them";

export interface CompareSlot {
  set: PlannableSet;
  kind: OverlapKind;
}

export interface CompareResult {
  /** Timeline-ordered slots (by startMs). */
  slots: CompareSlot[];
  /** Sets both users share (sorted by time). */
  overlap: PlannableSet[];
  /** Sets only you have. */
  onlyYou: PlannableSet[];
  /** Sets only they have. */
  onlyThem: PlannableSet[];
  /** Percentage overlap: overlap.length / union.length (0–1). */
  overlapRatio: number;
}

export interface CompareDay {
  dayKey: string;
  label: string;
  yourCount: number;
  theirCount: number;
  overlapCount: number;
}

/**
 * Compare two members' sets for a single day.
 * `yourSetIds` and `theirSetIds` are the performance IDs each person shared.
 * `allDaySets` is the full set of PlannableSets for that day (used to enrich IDs → full objects).
 */
export function comparePlans(
  yourSetIds: ReadonlySet<string>,
  theirSetIds: ReadonlySet<string>,
  allDaySets: PlannableSet[]
): CompareResult {
  const setById = new Map(allDaySets.map((s) => [s.id, s]));
  const unionIds = new Set([...yourSetIds, ...theirSetIds]);

  const overlap: PlannableSet[] = [];
  const onlyYou: PlannableSet[] = [];
  const onlyThem: PlannableSet[] = [];
  const slots: CompareSlot[] = [];

  for (const id of unionIds) {
    const set = setById.get(id);
    if (!set) continue;
    const youHave = yourSetIds.has(id);
    const theyHave = theirSetIds.has(id);
    if (youHave && theyHave) {
      overlap.push(set);
      slots.push({ set, kind: "both" });
    } else if (youHave) {
      onlyYou.push(set);
      slots.push({ set, kind: "only_you" });
    } else {
      onlyThem.push(set);
      slots.push({ set, kind: "only_them" });
    }
  }

  slots.sort((a, b) => a.set.startMs - b.set.startMs);
  overlap.sort((a, b) => a.startMs - b.startMs);
  onlyYou.sort((a, b) => a.startMs - b.startMs);
  onlyThem.sort((a, b) => a.startMs - b.startMs);

  const unionSize = slots.length;
  const overlapRatio = unionSize > 0 ? overlap.length / unionSize : 0;

  return { slots, overlap, onlyYou, onlyThem, overlapRatio };
}

/**
 * Summarize comparison across all days for the day picker badges.
 */
export function compareDaySummary(
  yourIdsByDay: Map<string, Set<string>>,
  theirIdsByDay: Map<string, Set<string>>,
  days: { key: string; label: string }[]
): CompareDay[] {
  return days.map((day) => {
    const yours = yourIdsByDay.get(day.key) ?? new Set<string>();
    const theirs = theirIdsByDay.get(day.key) ?? new Set<string>();
    let overlapCount = 0;
    for (const id of yours) {
      if (theirs.has(id)) overlapCount++;
    }
    return {
      dayKey: day.key,
      label: day.label,
      yourCount: yours.size,
      theirCount: theirs.size,
      overlapCount,
    };
  });
}

/**
 * Find the next shared set (both attending) from now — useful for the "next time together" hero.
 */
export function nextSharedSet(
  overlap: PlannableSet[],
  nowMs: number
): PlannableSet | null {
  return overlap.find((s) => s.endMs > nowMs) ?? null;
}
