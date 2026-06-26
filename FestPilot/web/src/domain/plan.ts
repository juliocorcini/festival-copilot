/**
 * Pure timeline model for My Plan (#21, DEC-018/029/073/074): turns the day's locked sets — plus the
 * user's personal blocks (eat/rest/water/meet/explore/custom) — into one chronological list of items:
 *   • set items (done / now / upcoming) carrying their EFFECTIVE start/end after travel choices,
 *   • block items (personal activities), and
 *   • gap items carrying the walk time between stages plus the free idle window a block could fill.
 *
 * It also resolves the travel between consecutive SETS (DEC-074): when the walk would overlap the
 * next set, it applies the user's choice — or the global default — to either leave the current set
 * early or arrive at the next one late, so the displayed times are honest. The conflict is exposed on
 * the destination set so the UI can offer the trade-off. Travel comes from a `TravelMatrix`.
 * No DOM/React — the screen renders this; the math is unit-tested.
 */
import { effectiveEnd as cutEnd, effectiveStart as lateStartOf } from "./planSlot";
import type { PlanBlock, PlanSlot, TravelMatrix } from "./types";

const MIN = 60_000;
/** Idle minutes (beyond the walk) before a gap counts as a deliberate "break" worth showing. */
export const BREAK_THRESHOLD_MIN = 20;
/** Spare idle (minutes) a gap must offer before it surfaces a "fill this gap" CTA. */
export const FILLABLE_THRESHOLD_MIN = 15;

/** Global preference for how to absorb a travel overlap; overridable per transition (DEC-074). */
export type TravelPref = "leave-early" | "arrive-late";
export type SetStatus = "done" | "now" | "upcoming";
export type TravelResolution = "leave-early" | "arrive-late" | "none";

export interface TravelInfo {
  fromSetId: string;
  fromStageName: string;
  walkMinutes: number;
  /** Minutes of music given up to make the walk (the overlap, or the late-arrival amount). 0 = roomy. */
  lostMinutes: number;
  resolution: TravelResolution;
  /** True when the user picked this explicitly; false when it's the global-default auto-resolution. */
  explicit: boolean;
  /** False when even leaving the previous set at its very start can't reach this one in time. */
  feasible: boolean;
}

export interface PlanSetItem {
  kind: "set";
  slot: PlanSlot;
  status: SetStatus;
  /** Effective start (arrive-late applied). */
  startMs: number;
  /** Effective end (leave-early applied — explicit cut OR the global-default trim). */
  endMs: number;
  /** The transition INTO this set from the previous set, or null for the first set of the day. */
  travelIn: TravelInfo | null;
}

export interface PlanBlockItem {
  kind: "block";
  block: PlanBlock;
  status: SetStatus;
}

export interface PlanGapItem {
  kind: "gap";
  fromStageName: string;
  toStageName: string;
  walkMinutes: number;
  /** Idle minutes beyond the walk; `>= BREAK_THRESHOLD_MIN` renders a break chip. */
  breakMinutes: number;
  /** A block could occupy [fillStartMs, fillEndMs); `freeMinutes >= FILLABLE_THRESHOLD_MIN` ⇒ CTA. */
  fillStartMs: number;
  fillEndMs: number;
  freeMinutes: number;
}

export type PlanItem = PlanSetItem | PlanBlockItem | PlanGapItem;

export interface PlanTimeline {
  items: PlanItem[];
  setCount: number;
  breakCount: number;
  blockCount: number;
  /** Set→set transitions resolved by the GLOBAL DEFAULT (not the user) — a hint they can be reviewed. */
  conflictCount: number;
}

interface ResolvedSet {
  slot: PlanSlot;
  startMs: number;
  endMs: number;
  travelIn: TravelInfo | null;
}

function statusOf(startMs: number, endMs: number, nowMs: number): SetStatus {
  if (nowMs >= endMs) return "done";
  if (nowMs >= startMs) return "now";
  return "upcoming";
}

/**
 * One forward pass over the day's sets that turns each into its effective interval, applying explicit
 * travel choices first and the global default to any remaining overlap. Leaving early retro-trims the
 * previous set's end; arriving late pushes this set's start. Only the CHOICE is ever persisted
 * (cutMs / lateStartMs) — these derived times recompute on every add/swap, so edits never corrupt.
 */
function resolveSets(slots: PlanSlot[], travel: TravelMatrix, pref: TravelPref): ResolvedSet[] {
  const ordered = [...slots].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const out: ResolvedSet[] = [];

  ordered.forEach((slot, i) => {
    let startMs = lateStartOf(slot); // honors an explicit arrive-late
    const endMs = cutEnd(slot); // honors an explicit leave-early
    let travelIn: TravelInfo | null = null;

    if (i > 0) {
      const prev = out[i - 1]!;
      const walk = Math.max(0, travel.minutesBetween(prev.slot.stageId, slot.stageId));
      const walkMs = walk * MIN;
      const earliestArrive = prev.endMs + walkMs; // leaving prev at its effective end
      const explicitLate = lateStartOf(slot) > slot.startMs;
      const overlap = Math.max(0, earliestArrive - startMs);

      let resolution: TravelResolution = "none";
      let explicit = false;
      let feasible = true;
      let lostMinutes = 0;

      if (explicitLate) {
        resolution = "arrive-late";
        explicit = true;
        lostMinutes = Math.round((startMs - slot.startMs) / MIN);
        feasible = overlap === 0; // a late start earlier than the walk allows is infeasible
      } else if (overlap > 0) {
        lostMinutes = Math.round(overlap / MIN);
        if (pref === "arrive-late") {
          startMs = earliestArrive;
          resolution = "arrive-late";
        } else {
          const trimmed = startMs - walkMs;
          if (trimmed > prev.slot.startMs) {
            prev.endMs = trimmed;
          } else {
            prev.endMs = prev.slot.startMs; // honest border: can't make it even leaving at the start
            feasible = false;
          }
          resolution = "leave-early";
        }
      }

      travelIn = { fromSetId: prev.slot.setId, fromStageName: prev.slot.stageName, walkMinutes: walk, lostMinutes, resolution, explicit, feasible };
    }

    out.push({ slot, startMs, endMs, travelIn });
  });

  return out;
}

type Anchor =
  | { kind: "set"; start: number; end: number; resolved: ResolvedSet }
  | { kind: "block"; start: number; end: number; block: PlanBlock };

/** Build the rendered plan timeline: resolve set travel, then interleave blocks and gaps by time. */
export function buildPlanTimeline(
  slots: PlanSlot[],
  blocks: PlanBlock[],
  travel: TravelMatrix,
  nowMs: number,
  pref: TravelPref = "leave-early"
): PlanTimeline {
  const resolved = resolveSets(slots, travel, pref);
  const anchors: Anchor[] = [
    ...resolved.map((r): Anchor => ({ kind: "set", start: r.startMs, end: r.endMs, resolved: r })),
    ...blocks.map((b): Anchor => ({ kind: "block", start: b.startMs, end: b.endMs, block: b })),
  ].sort((a, b) => a.start - b.start || a.end - b.end);

  const items: PlanItem[] = [];
  let breakCount = 0;
  let conflictCount = 0;

  anchors.forEach((anchor, index) => {
    if (anchor.kind === "set") {
      const r = anchor.resolved;
      items.push({ kind: "set", slot: r.slot, status: statusOf(r.startMs, r.endMs, nowMs), startMs: r.startMs, endMs: r.endMs, travelIn: r.travelIn });
      if (r.travelIn && !r.travelIn.explicit && r.travelIn.resolution !== "none") conflictCount++;
    } else {
      items.push({ kind: "block", block: anchor.block, status: statusOf(anchor.start, anchor.end, nowMs) });
    }

    const next = anchors[index + 1];
    if (!next) return;

    // A walk only applies between two sets at different stages; a block has no stage of its own.
    const walk =
      anchor.kind === "set" && next.kind === "set"
        ? Math.max(0, travel.minutesBetween(anchor.resolved.slot.stageId, next.resolved.slot.stageId))
        : 0;
    const idleMin = Math.max(0, Math.round((next.start - anchor.end) / MIN));
    const breakMin = Math.max(0, idleMin - walk);
    const freeMinutes = breakMin;
    if (walk === 0 && breakMin < BREAK_THRESHOLD_MIN && freeMinutes < FILLABLE_THRESHOLD_MIN) return;
    if (breakMin >= BREAK_THRESHOLD_MIN) breakCount++;

    items.push({
      kind: "gap",
      fromStageName: anchor.kind === "set" ? anchor.resolved.slot.stageName : "",
      toStageName: next.kind === "set" ? next.resolved.slot.stageName : "",
      walkMinutes: walk,
      breakMinutes: breakMin,
      fillStartMs: anchor.end,
      fillEndMs: next.start - walk * MIN,
      freeMinutes,
    });
  });

  return { items, setCount: resolved.length, breakCount, blockCount: blocks.length, conflictCount };
}
