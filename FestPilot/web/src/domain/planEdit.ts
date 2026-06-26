/**
 * Pure edits for a locked plan (R8, DEC-017/029/041/073/074). The Lock-in resolver builds a ZERO-overlap
 * plan by construction; these helpers let the user tweak it afterwards — remove / add / swap a set,
 * slot in a personal block (eat/rest/…), or choose how to absorb a travel overlap — WITHOUT re-walking
 * Lock-in and while preserving that same zero-overlap invariant. No DOM/React.
 */
import { overlaps } from "./intervals";
import { effectiveInterval } from "./planSlot";
import type { PlanBlock, PlannableSet, PlanSlot } from "./types";

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
    lateStartMs: null,
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
  return slots.every((slot) => slot.setId === exceptSetId || !overlaps(candidate, effectiveInterval(slot)));
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

// ── Personal blocks (DEC-073) ────────────────────────────────────────────────
// Blocks live ONLY in the local plan; they never overlap a set's effective interval or another block.

function byBlockStart(a: PlanBlock, b: PlanBlock): number {
  return a.startMs - b.startMs || a.endMs - b.endMs;
}

/** True iff `[startMs, endMs)` is free of every set's effective interval and every block (bar `exceptId`). */
export function rangeIsFree(
  slots: PlanSlot[],
  blocks: PlanBlock[],
  range: { startMs: number; endMs: number },
  exceptBlockId?: string
): boolean {
  if (!Number.isFinite(range.startMs) || !Number.isFinite(range.endMs) || range.endMs <= range.startMs) return false;
  if (slots.some((slot) => overlaps(range, effectiveInterval(slot)))) return false;
  return blocks.every((block) => block.id === exceptBlockId || !overlaps(range, { startMs: block.startMs, endMs: block.endMs }));
}

/** Add a personal block, kept chronological. Returns `null` if it overlaps a set or another block. */
export function addBlock(slots: PlanSlot[], blocks: PlanBlock[], block: PlanBlock): PlanBlock[] | null {
  if (!rangeIsFree(slots, blocks, { startMs: block.startMs, endMs: block.endMs })) return null;
  return [...blocks, block].sort(byBlockStart);
}

/** Move/resize a block to `[startMs, endMs)`. Returns `null` if it's unknown or would overlap. */
export function resizeBlock(
  slots: PlanSlot[],
  blocks: PlanBlock[],
  id: string,
  startMs: number,
  endMs: number
): PlanBlock[] | null {
  if (!blocks.some((block) => block.id === id)) return null;
  if (!rangeIsFree(slots, blocks, { startMs, endMs }, id)) return null;
  return blocks.map((block) => (block.id === id ? { ...block, startMs, endMs } : block)).sort(byBlockStart);
}

/** Update a block's kind/label/note without touching its times (always valid). */
export function editBlockMeta(
  blocks: PlanBlock[],
  id: string,
  patch: Partial<Pick<PlanBlock, "kind" | "label" | "note">>
): PlanBlock[] {
  return blocks.map((block) => (block.id === id ? { ...block, ...patch } : block));
}

/** Remove a block. */
export function removeBlock(blocks: PlanBlock[], id: string): PlanBlock[] {
  return blocks.filter((block) => block.id !== id);
}

// ── Travel choice (DEC-074) ──────────────────────────────────────────────────
// Both options only ever SHRINK an effective interval (cut the end, or push the start), so neither can
// create an overlap — the zero-overlap invariant is preserved without a fit check.

/** Leave `fromSetId` early at `departMs` to make the walk into `toSetId` (clears any arrive-late there). */
export function applyLeaveEarly(slots: PlanSlot[], fromSetId: string, toSetId: string, departMs: number): PlanSlot[] {
  return slots.map((slot) => {
    if (slot.setId === fromSetId) return { ...slot, cutMs: departMs };
    if (slot.setId === toSetId) return { ...slot, lateStartMs: null };
    return slot;
  });
}

/** Arrive at `toSetId` late at `arriveMs` after the walk from `fromSetId` (clears any leave-early there). */
export function applyArriveLate(slots: PlanSlot[], fromSetId: string, toSetId: string, arriveMs: number): PlanSlot[] {
  return slots.map((slot) => {
    if (slot.setId === toSetId) return { ...slot, lateStartMs: arriveMs };
    if (slot.setId === fromSetId) return { ...slot, cutMs: null };
    return slot;
  });
}

/** Clear both travel adjustments for the `fromSetId → toSetId` transition (see the full sets). */
export function clearTravelChoice(slots: PlanSlot[], fromSetId: string, toSetId: string): PlanSlot[] {
  return slots.map((slot) => {
    if (slot.setId === fromSetId) return { ...slot, cutMs: null };
    if (slot.setId === toSetId) return { ...slot, lateStartMs: null };
    return slot;
  });
}
