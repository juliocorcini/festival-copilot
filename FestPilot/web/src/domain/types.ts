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

/**
 * A locked entry in the personal plan.
 * - `cutMs` records a partial-set early-leave (DEC-018) — you leave before the scheduled end.
 * - `lateStartMs` is the symmetric travel choice (DEC-074): you arrive AFTER the scheduled start,
 *   used when walking from the previous set would otherwise make you miss its opening. Optional so
 *   plans persisted before this field load unchanged (DEC-041, no plan migration).
 */
export interface PlanSlot {
  setId: string;
  actKey: string;
  label: string;
  stageId: string | null;
  stageName: string;
  startMs: number;
  endMs: number;
  cutMs: number | null;
  lateStartMs?: number | null;
}

/** A personal, on-device-only activity the user slots into their day (DEC-073) — never shared. */
export type PlanBlockKind = "eat" | "rest" | "water" | "meet" | "explore" | "custom";

/**
 * A non-set block in the personal plan: eating, resting at the tent, water, meeting someone,
 * exploring, or a custom note. Lives ONLY in the local plan and is filtered out of every group
 * serialization (the squad plan is sets-only). Times are absolute ms; intervals never overlap a
 * set's effective interval or another block.
 */
export interface PlanBlock {
  id: string;
  kind: PlanBlockKind;
  label: string;
  startMs: number;
  endMs: number;
  note?: string;
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
