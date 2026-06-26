/**
 * The "effective interval" of a plan slot — the window you ACTUALLY attend, honoring the two personal
 * travel choices (DEC-018/074): leaving a set early (`cutMs`) trims its end, and arriving late
 * (`lateStartMs`) pushes its start. Centralized here so the timeline, Now & Next, plan edits and the
 * squad-share filter all share one definition. Pure, framework-free, exhaustively unit-tested.
 */
import type { PlanSlot } from "./types";

/** Effective start honoring an arrive-late travel choice (DEC-074); the scheduled start otherwise. */
export function effectiveStart(slot: PlanSlot): number {
  const late = slot.lateStartMs;
  return late != null && late > slot.startMs && late < slot.endMs ? late : slot.startMs;
}

/** Effective end honoring a partial-set early-leave cut (DEC-018); the scheduled end otherwise. */
export function effectiveEnd(slot: PlanSlot): number {
  const cut = slot.cutMs;
  return cut != null && cut > slot.startMs && cut < slot.endMs ? cut : slot.endMs;
}

/** [effectiveStart, effectiveEnd) — the interval used for every overlap/clash check. */
export function effectiveInterval(slot: PlanSlot): { startMs: number; endMs: number } {
  return { startMs: effectiveStart(slot), endMs: effectiveEnd(slot) };
}
