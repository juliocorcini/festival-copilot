/**
 * Pure domain types for Favorites → clash resolution → My Plan (DEC-005/017/018/026/029).
 * Framework-free so the logic is identical whether data is local (DEC-041) or server-backed,
 * and is exhaustively unit/property-tested.
 */

/** A schedulable set: one performance placed in absolute time (ms since epoch). */
export interface PlannableSet {
  id: string;
  actKey: string;
  label: string;
  stageId: string | null;
  stageName: string;
  startMs: number;
  endMs: number;
  day: string | null;
  weekendId: string | null;
}

/** A locked entry in the personal plan. `cutMs` records a partial-set early-leave (DEC-018). */
export interface PlanSlot {
  setId: string;
  actKey: string;
  label: string;
  stageId: string | null;
  stageName: string;
  startMs: number;
  endMs: number;
  cutMs: number | null;
}

/** A chronological clash: 2+ favorites whose intervals chain-overlap (DEC-017/029). */
export interface ClashDecision {
  index: number;
  startMs: number;
  endMs: number;
  options: PlannableSet[];
}

/** Stage-to-stage walking time. Stubbed in Phase 2 (DEC-018), real matrix in Phase 3. */
export interface TravelMatrix {
  minutesBetween(fromStageId: string | null, toStageId: string | null): number;
}
