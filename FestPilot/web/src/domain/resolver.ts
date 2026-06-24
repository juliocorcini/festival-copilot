/**
 * Gated, chronological, one-at-a-time clash resolver (DEC-017/029).
 *
 * Invariant (proved by construction + property-tested): the locked plan has ZERO overlaps.
 * Each locked set starts at or after the previous locked set's end (`lockedEnd`), so committing
 * to a choice "consumes" the timeline up to its end and any favorite overlapping that window is
 * dropped. Clashes (chain-overlap clusters of 2+ favorites) surface in time order; singles
 * auto-lock. The next clash only appears after the current pick ends — the "gate".
 */
import { clashAt } from "./intervals";
import type { ClashDecision, PlannableSet, PlanSlot } from "./types";

export interface ResolverSnapshot {
  locked: PlanSlot[];
  dropped: PlannableSet[];
  lockedEnd: number;
  pool: PlannableSet[];
  /** The clash awaiting a pick, or null when resolution is complete. */
  decision: ClashDecision | null;
  decisionsResolved: number;
  decisionsTotal: number;
}

function toSlot(set: PlannableSet): PlanSlot {
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

function isValid(set: PlannableSet): boolean {
  return Number.isFinite(set.startMs) && Number.isFinite(set.endMs) && set.endMs > set.startMs;
}

/** Count clashes remaining under a max-remaining (earliest-end) strategy — for the progress bar. */
function countRemainingClashes(pool: PlannableSet[], fromEnd: number): number {
  let end = fromEnd;
  let remaining = [...pool];
  let count = 0;
  let guard = 0;
  for (;;) {
    const options = clashAt(remaining, end);
    if (options === null || guard++ > 10_000) break;
    if (options.length > 1) count++;
    const choose = options.reduce((a, b) => (b.endMs < a.endMs ? b : a));
    end = choose.endMs;
    remaining = remaining.filter((s) => s.id !== choose.id);
  }
  return count;
}

interface Base {
  locked: PlanSlot[];
  dropped: PlannableSet[];
  lockedEnd: number;
  pool: PlannableSet[];
  decisionsResolved: number;
}

/** Auto-lock leading singles and drop now-conflicting sets until the next clash (or completion). */
function advance(base: Base): ResolverSnapshot {
  const locked = [...base.locked];
  const dropped = [...base.dropped];
  let lockedEnd = base.lockedEnd;
  let pool = [...base.pool];

  for (;;) {
    const available = pool.filter((s) => s.startMs >= lockedEnd);
    const late = pool.filter((s) => s.startMs < lockedEnd);
    if (late.length > 0) dropped.push(...late);
    pool = available;

    if (available.length === 0) {
      return {
        locked,
        dropped,
        lockedEnd,
        pool: [],
        decision: null,
        decisionsResolved: base.decisionsResolved,
        decisionsTotal: base.decisionsResolved,
      };
    }

    // The decision is the clash anchored at the earliest available set — only its true overlaps,
    // never a transitive chain. The gate below still consumes the timeline, so zero-overlap holds.
    const options = clashAt(available, lockedEnd)!; // available is non-empty here
    if (options.length === 1) {
      const single = options[0]!;
      locked.push(toSlot(single));
      lockedEnd = single.endMs;
      pool = available.filter((s) => s.id !== single.id);
      continue;
    }

    const anchor = options[0]!;
    const decision: ClashDecision = {
      index: base.decisionsResolved,
      startMs: anchor.startMs,
      endMs: Math.max(...options.map((o) => o.endMs)),
      options,
    };
    return {
      locked,
      dropped,
      lockedEnd,
      pool: available,
      decision,
      decisionsResolved: base.decisionsResolved,
      decisionsTotal: base.decisionsResolved + countRemainingClashes(available, lockedEnd),
    };
  }
}

export function startResolver(favorites: PlannableSet[]): ResolverSnapshot {
  const valid = favorites.filter(isValid);
  return advance({ locked: [], dropped: [], lockedEnd: -Infinity, pool: valid, decisionsResolved: 0 });
}

/** Lock a chosen set (optionally cut early for a partial set, DEC-018), then auto-advance. */
function lockAndAdvance(snapshot: ResolverSnapshot, chosen: PlannableSet, cutMs: number | null): ResolverSnapshot {
  const slot = toSlot(chosen);
  // A partial set keeps the gate at the early-leave time, freeing later overlapping favorites.
  const consumedEnd = cutMs != null && cutMs > chosen.startMs && cutMs < chosen.endMs ? cutMs : chosen.endMs;
  return advance({
    locked: [...snapshot.locked, { ...slot, cutMs: cutMs != null && cutMs < chosen.endMs ? cutMs : null }],
    dropped: [...snapshot.dropped],
    lockedEnd: consumedEnd,
    pool: snapshot.pool.filter((s) => s.id !== chosen.id),
    decisionsResolved: snapshot.decisionsResolved + 1,
  });
}

/** Lock the chosen option for the current clash, then auto-advance to the next decision. */
export function pickOption(snapshot: ResolverSnapshot, setId: string, cutMs: number | null = null): ResolverSnapshot {
  if (!snapshot.decision) return snapshot;
  const chosen = snapshot.decision.options.find((o) => o.id === setId);
  if (!chosen) return snapshot;
  return lockAndAdvance(snapshot, chosen, cutMs);
}

/**
 * Lock an arbitrary set (e.g. an act added from the "around this time" search) that respects the
 * gate (starts at/after the last locked end). Used when the chosen set is not one of the cluster's
 * auto-detected options. No-op if it would break the zero-overlap invariant.
 */
export function pickSet(snapshot: ResolverSnapshot, set: PlannableSet, cutMs: number | null = null): ResolverSnapshot {
  if (!isValid(set) || set.startMs < snapshot.lockedEnd) return snapshot;
  return lockAndAdvance(snapshot, set, cutMs);
}

export interface ClashWindow {
  startMs: number;
  endMs: number;
  optionCount: number;
}

/**
 * The remaining clash windows (current first) under the earliest-end preview strategy — powers the
 * "all clashes" overview. It's a preview: the actual count can shrink as longer picks absorb later
 * clashes, but it never undercounts what the user still has to decide.
 */
export function previewRemainingClashes(snapshot: ResolverSnapshot): ClashWindow[] {
  const windows: ClashWindow[] = [];
  let end = snapshot.lockedEnd;
  let remaining = [...snapshot.pool];
  let guard = 0;
  for (;;) {
    const options = clashAt(remaining, end);
    if (options === null || guard++ > 10_000) break;
    if (options.length > 1) {
      windows.push({ startMs: options[0]!.startMs, endMs: Math.max(...options.map((o) => o.endMs)), optionCount: options.length });
    }
    const choose = options.reduce((a, b) => (b.endMs < a.endMs ? b : a));
    end = choose.endMs;
    remaining = remaining.filter((s) => s.id !== choose.id);
  }
  return windows;
}

export type PickStrategy = (decision: ClashDecision) => PlannableSet;

export const pickFirst: PickStrategy = (d) => d.options[0]!;
export const pickEarliestEnd: PickStrategy = (d) =>
  d.options.reduce((a, b) => (b.endMs < a.endMs ? b : a));

/** Batch driver: resolve every clash with a strategy. Used by the no-overlap property tests. */
export function resolvePlan(
  favorites: PlannableSet[],
  strategy: PickStrategy = pickEarliestEnd
): { locked: PlanSlot[]; dropped: PlannableSet[] } {
  let snapshot = startResolver(favorites);
  let guard = 0;
  while (snapshot.decision && guard++ < 10_000) {
    snapshot = pickOption(snapshot, strategy(snapshot.decision).id);
  }
  return { locked: snapshot.locked, dropped: snapshot.dropped };
}
