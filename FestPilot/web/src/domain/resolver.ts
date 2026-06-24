/**
 * Gated, chronological, one-at-a-time clash resolver (DEC-017/029).
 *
 * Invariant (proved by construction + property-tested): the locked plan has ZERO overlaps.
 * Each locked set starts at or after the previous locked set's end (`lockedEnd`), so committing
 * to a choice "consumes" the timeline up to its end and any favorite overlapping that window is
 * dropped. Clashes (chain-overlap clusters of 2+ favorites) surface in time order; singles
 * auto-lock. The next clash only appears after the current pick ends — the "gate".
 */
import { byStart, clusterByOverlap } from "./intervals";
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
  let remaining = pool.filter((s) => s.startMs >= end).sort(byStart);
  let count = 0;
  while (remaining.length > 0) {
    remaining = remaining.filter((s) => s.startMs >= end);
    if (remaining.length === 0) break;
    const cluster = clusterByOverlap(remaining)[0]!;
    if (cluster.length > 1) count++;
    const choose = cluster.reduce((a, b) => (b.endMs < a.endMs ? b : a));
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

    const cluster = clusterByOverlap(available)[0]!;
    if (cluster.length === 1) {
      const single = cluster[0]!;
      locked.push(toSlot(single));
      lockedEnd = single.endMs;
      pool = available.filter((s) => s.id !== single.id);
      continue;
    }

    const decision: ClashDecision = {
      index: base.decisionsResolved,
      startMs: cluster[0]!.startMs,
      endMs: Math.max(...cluster.map((c) => c.endMs)),
      options: [...cluster].sort(byStart),
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

/** Lock the chosen option for the current clash, then auto-advance to the next decision. */
export function pickOption(snapshot: ResolverSnapshot, setId: string): ResolverSnapshot {
  if (!snapshot.decision) return snapshot;
  const chosen = snapshot.decision.options.find((o) => o.id === setId);
  if (!chosen) return snapshot;
  return advance({
    locked: [...snapshot.locked, toSlot(chosen)],
    dropped: [...snapshot.dropped],
    lockedEnd: chosen.endMs,
    pool: snapshot.pool.filter((s) => s.id !== chosen.id),
    decisionsResolved: snapshot.decisionsResolved + 1,
  });
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
