/**
 * Pure edits for a locked plan (R8, DEC-017/029/041). The Lock-in resolver builds a ZERO-overlap
 * plan by construction; these helpers let the user tweak it afterwards (remove / add / swap a set)
 * WITHOUT re-walking Lock-in, while preserving that same zero-overlap invariant. No DOM/React.
 */
import { overlaps } from "./intervals";
import type { PlannableSet, PlanSlot } from "./types";

/** Effective end honoring a partial-set early-leave cut (DEC-018). */
function effectiveEnd(slot: PlanSlot): number {
  return slot.cutMs != null && slot.cutMs > slot.startMs && slot.cutMs < slot.endMs ? slot.cutMs : slot.endMs;
}

function slotInterval(slot: PlanSlot): { startMs: number; endMs: number } {
  return { startMs: slot.startMs, endMs: effectiveEnd(slot) };
}

function setToSlot(set: PlannableSet): PlanSlot {
  return {
    setId: set.id,
    actKey: set.actKey,
    label: set.label,
    stageId: set.stageId,
    stageName: set.stageName,
    startMs: set.startMs,
    endMs: set.endMs,
    cutMs: null,
  };
}

function bySlotStart(a: PlanSlot, b: PlanSlot): number {
  return a.startMs - b.startMs || a.endMs - b.endMs;
}

/**
 * True iff `candidate` can sit among `slots` without overlapping any of them. `exceptSetId` ignores
 * one slot (the set being swapped out, so a same-window replacement is allowed).
 */
export function setFits(
  slots: PlanSlot[],
  candidate: { startMs: number; endMs: number },
  exceptSetId?: string
): boolean {
  if (!Number.isFinite(candidate.startMs) || !Number.isFinite(candidate.endMs) || candidate.endMs <= candidate.startMs) {
    return false;
  }
  return slots.every((slot) => slot.setId === exceptSetId || !overlaps(candidate, slotInterval(slot)));
}

/** Remove a set from the plan. Removing can never create an overlap, so the invariant always holds. */
export function removeFromPlan(slots: PlanSlot[], setId: string): PlanSlot[] {
  return slots.filter((slot) => slot.setId !== setId);
}

/**
 * Add a set, keeping the plan chronological + zero-overlap. Returns the new slots, the unchanged
 * slots if the act is already in the plan, or `null` if the set would overlap an existing one.
 */
export function addToPlan(slots: PlanSlot[], set: PlannableSet): PlanSlot[] | null {
  if (slots.some((slot) => slot.setId === set.id || slot.actKey === set.actKey)) return slots;
  if (!setFits(slots, set)) return null;
  return [...slots, setToSlot(set)].sort(bySlotStart);
}

/**
 * Replace `oldSetId` with `set`, keeping zero-overlap (the new set is checked against every OTHER
 * slot). Returns `null` if the old set isn't in the plan or the replacement would overlap.
 */
export function swapInPlan(slots: PlanSlot[], oldSetId: string, set: PlannableSet): PlanSlot[] | null {
  if (!slots.some((slot) => slot.setId === oldSetId)) return null;
  if (slots.some((slot) => slot.setId !== oldSetId && slot.actKey === set.actKey)) return null;
  if (!setFits(slots, set, oldSetId)) return null;
  return [...slots.filter((slot) => slot.setId !== oldSetId), setToSlot(set)].sort(bySlotStart);
}

/** Keep only candidate sets that fit the plan as a swap for `oldSetId` (used to gate the swap picker). */
export function fittingSwaps(slots: PlanSlot[], oldSetId: string, candidates: PlannableSet[]): PlannableSet[] {
  return candidates.filter((set) => set.id !== oldSetId && setFits(slots, set, oldSetId));
}

/** Keep only candidate sets that fit the plan as a new addition (no overlap, not already chosen). */
export function fittingAdds(slots: PlanSlot[], candidates: PlannableSet[]): PlannableSet[] {
  const chosenActs = new Set(slots.map((slot) => slot.actKey));
  return candidates.filter((set) => !chosenActs.has(set.actKey) && setFits(slots, set));
}
