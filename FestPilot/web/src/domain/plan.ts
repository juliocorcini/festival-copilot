/**
 * Pure timeline model for My Plan (#21, DEC-018/029): turns locked slots into a chronological list
 * of set items (done / now / upcoming) interleaved with gap items that carry the walk time between
 * stages and any idle "break" beyond the walk. Travel comes from a `TravelMatrix` (flat in Phase 2,
 * georeferenced in Phase 3). No DOM/React — the screen only renders this; the math is unit-tested.
 */
import type { PlanSlot, TravelMatrix } from "./types";

const MIN = 60_000;
/** Idle minutes (beyond the walk) before a gap counts as a deliberate "break" worth showing. */
export const BREAK_THRESHOLD_MIN = 20;

export type SetStatus = "done" | "now" | "upcoming";

export interface PlanSetItem {
  kind: "set";
  slot: PlanSlot;
  status: SetStatus;
  /** Effective end honoring a partial-set cut (DEC-018). */
  endMs: number;
}

export interface PlanGapItem {
  kind: "gap";
  fromStageName: string;
  toStageName: string;
  walkMinutes: number;
  /** Idle minutes beyond the walk; `>= BREAK_THRESHOLD_MIN` renders a break chip. */
  breakMinutes: number;
}

export type PlanItem = PlanSetItem | PlanGapItem;

export interface PlanTimeline {
  items: PlanItem[];
  setCount: number;
  breakCount: number;
}

function effectiveEnd(slot: PlanSlot): number {
  return slot.cutMs != null && slot.cutMs > slot.startMs && slot.cutMs < slot.endMs ? slot.cutMs : slot.endMs;
}

function statusOf(slot: PlanSlot, endMs: number, nowMs: number): SetStatus {
  if (nowMs >= endMs) return "done";
  if (nowMs >= slot.startMs) return "now";
  return "upcoming";
}

/** Build the rendered plan timeline. Slots are sorted by start; gaps are inserted between sets. */
export function buildPlanTimeline(slots: PlanSlot[], travel: TravelMatrix, nowMs: number): PlanTimeline {
  const ordered = [...slots].sort((a, b) => a.startMs - b.startMs);
  const items: PlanItem[] = [];
  let breakCount = 0;

  ordered.forEach((slot, index) => {
    const endMs = effectiveEnd(slot);
    items.push({ kind: "set", slot, status: statusOf(slot, endMs, nowMs), endMs });

    const next = ordered[index + 1];
    if (!next) return;
    const walkMinutes = Math.max(0, travel.minutesBetween(slot.stageId, next.stageId));
    const gapMinutes = Math.max(0, Math.round((next.startMs - endMs) / MIN));
    const breakMinutes = Math.max(0, gapMinutes - walkMinutes);
    if (walkMinutes === 0 && breakMinutes < BREAK_THRESHOLD_MIN) return;
    if (breakMinutes >= BREAK_THRESHOLD_MIN) breakCount++;
    items.push({
      kind: "gap",
      fromStageName: slot.stageName,
      toStageName: next.stageName,
      walkMinutes,
      breakMinutes,
    });
  });

  return { items, setCount: ordered.length, breakCount };
}
