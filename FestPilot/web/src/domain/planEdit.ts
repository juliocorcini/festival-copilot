/**
 * Pure edits for a locked plan (R8, DEC-017/029/041/073/074). The Lock-in resolver builds a ZERO-overlap
 * plan by construction; these helpers let the user tweak it afterwards — remove / add / swap a set,
 * slot in a personal block (eat/rest/…), or choose how to absorb a travel overlap — WITHOUT re-walking
 * Lock-in and while preserving that same zero-overlap invariant. No DOM/React.
 */
import { overlaps } from "./intervals";
import { effectiveEnd, effectiveInterval, effectiveStart } from "./planSlot";
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

/**
 * Like `fittingAdds` but additionally restricted to sets whose time overlaps a specific window
 * [windowStart, windowEnd). Used when inserting a set in a known gap (DEC-109 / F01): the picker
 * should only show sets that PLAY during that window, not the whole day.
 *
 * RELAXED matching (DEC-115): a set that STARTS within the window is shown even if its endMs
 * extends past the next slot — the user can choose to leave early or arrive late. We only exclude
 * sets that are completely outside the window or are already in the plan.
 */
export function fittingAddsInWindow(
  slots: PlanSlot[],
  candidates: PlannableSet[],
  windowStart: number,
  windowEnd: number
): PlannableSet[] {
  const chosenActs = new Set(slots.map((slot) => slot.actKey));
  return candidates.filter(
    (set) =>
      !chosenActs.has(set.actKey) &&
      set.startMs < windowEnd &&
      set.endMs > windowStart &&
      set.startMs >= windowStart - 15 * 60_000
  );
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

/**
 * Split a tight walk down the middle (DEC-079/C2): leave `fromSetId` early AND arrive at `toSetId`
 * late, so each set gives up roughly half the lost music — "the smallest loss on both sides". Both
 * edits only shrink an effective interval, so the zero-overlap invariant holds without a fit check.
 */
export function applySplitTravel(
  slots: PlanSlot[],
  fromSetId: string,
  toSetId: string,
  departMs: number,
  arriveMs: number
): PlanSlot[] {
  return slots.map((slot) => {
    if (slot.setId === fromSetId) return { ...slot, cutMs: departMs };
    if (slot.setId === toSetId) return { ...slot, lateStartMs: arriveMs };
    return slot;
  });
}

// ── Insert between two cards (DEC-081) ───────────────────────────────────────
// "Where does the time come from?" — open a free window between two consecutive sets to drop a
// personal block into, carving the shortfall from the previous set's end, the next set's start, or
// both. We reuse the same cut/late fields as travel choices, which ONLY ever shrink a set, so the
// plan stays zero-overlap by construction.

/** Which neighbour gives up the time when inserting between two back-to-back sets. */
export type CarveSource = "before" | "after" | "split";

export interface CarveResult {
  /** The slots after carving (a copy; unchanged when the free room already fits). */
  slots: PlanSlot[];
  /** The freed window a block can occupy, `[startMs, endMs)`. */
  startMs: number;
  endMs: number;
}

/**
 * Open a `durationMs` window between the consecutive sets `beforeSetId`→`afterSetId`. Any existing
 * free gap is used first; only the shortfall is carved from the chosen `source`. Returns the carved
 * slots + the freed window, or `null` when that side can't give the time without erasing a set.
 */
export function carveWindow(
  slots: PlanSlot[],
  beforeSetId: string,
  afterSetId: string,
  durationMs: number,
  source: CarveSource
): CarveResult | null {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  const before = slots.find((slot) => slot.setId === beforeSetId);
  const after = slots.find((slot) => slot.setId === afterSetId);
  if (!before || !after) return null;

  const bEnd = effectiveEnd(before);
  const aStart = effectiveStart(after);
  const freeMs = Math.max(0, aStart - bEnd);
  const need = durationMs - freeMs; // extra time to carve beyond the existing free room

  if (need <= 0) {
    // Enough idle time already — drop the block at the start of the free window, carve nothing.
    return { slots, startMs: bEnd, endMs: bEnd + durationMs };
  }

  if (source === "before") {
    const newEnd = bEnd - need;
    if (newEnd <= before.startMs) return null;
    return { slots: withCut(slots, beforeSetId, newEnd), startMs: newEnd, endMs: aStart };
  }
  if (source === "after") {
    const newStart = aStart + need;
    if (newStart >= after.endMs) return null;
    return { slots: withLate(slots, afterSetId, newStart), startMs: bEnd, endMs: newStart };
  }
  // split — symmetric halves (the odd minute goes to the later arrival)
  const fromBefore = Math.floor(need / 2);
  const fromAfter = need - fromBefore;
  const newEnd = bEnd - fromBefore;
  const newStart = aStart + fromAfter;
  if (newEnd <= before.startMs || newStart >= after.endMs) return null;
  return {
    slots: slots.map((slot) => {
      if (slot.setId === beforeSetId) return { ...slot, cutMs: newEnd };
      if (slot.setId === afterSetId) return { ...slot, lateStartMs: newStart };
      return slot;
    }),
    startMs: newEnd,
    endMs: newStart,
  };
}

function withCut(slots: PlanSlot[], setId: string, cutMs: number): PlanSlot[] {
  return slots.map((slot) => (slot.setId === setId ? { ...slot, cutMs } : slot));
}

function withLate(slots: PlanSlot[], setId: string, lateStartMs: number): PlanSlot[] {
  return slots.map((slot) => (slot.setId === setId ? { ...slot, lateStartMs } : slot));
}
