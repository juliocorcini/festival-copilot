// Pure lineup diffing: compare what we have stored against a freshly fetched,
// normalized lineup and emit a list of changes. Keyed by source_performance_id
// (stable across re-fetches). This is the heart of "detect a change" in the cron.

import type { NormalizedLineup } from "../lineup/types";

export type ChangeType =
  | "added"
  | "removed"
  | "time_changed"
  | "stage_changed"
  | "artist_changed";

/** A performance as it currently exists in our database (projection for diffing). */
export interface ExistingPerformance {
  id: string;
  sourcePerformanceId: string;
  stageSourceId: string | null;
  startAtUtc: string | null;
  endAtUtc: string | null;
  artistSourceIds: string[];
  active: boolean;
}

/** A performance as it arrives from the freshly normalized lineup (projection for diffing). */
export interface IncomingPerformance {
  sourcePerformanceId: string;
  name: string;
  stageSourceId: string;
  startAtUtc: string;
  endAtUtc: string;
  artistSourceIds: string[];
}

export interface LineupChangeRecord {
  changeType: ChangeType;
  sourcePerformanceId: string;
  performanceId?: string; // known when the row already exists
  before?: unknown;
  after?: unknown;
}

/** Project the normalized lineup into the minimal shape used for diffing. */
export function projectIncoming(lineup: NormalizedLineup): IncomingPerformance[] {
  return lineup.performances.map((p) => ({
    sourcePerformanceId: p.sourceId,
    name: p.name,
    stageSourceId: p.stageId,
    startAtUtc: p.startAt.toISOString(),
    endAtUtc: p.endAt.toISOString(),
    artistSourceIds: p.artists.map((a) => a.id),
  }));
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

/**
 * Diff existing vs incoming. A single performance may yield multiple change
 * records (e.g. both time_changed and stage_changed). Removed acts are those we
 * still have active but are absent from the incoming set.
 */
export function diffLineup(
  existing: ExistingPerformance[],
  incoming: IncomingPerformance[]
): LineupChangeRecord[] {
  const bySource = new Map(existing.map((e) => [e.sourcePerformanceId, e]));
  const incomingIds = new Set(incoming.map((i) => i.sourcePerformanceId));
  const changes: LineupChangeRecord[] = [];

  for (const inc of incoming) {
    const prev = bySource.get(inc.sourcePerformanceId);
    if (!prev || !prev.active) {
      changes.push({
        changeType: "added",
        sourcePerformanceId: inc.sourcePerformanceId,
        performanceId: prev?.id,
        after: inc,
      });
      continue;
    }
    if (prev.startAtUtc !== inc.startAtUtc || prev.endAtUtc !== inc.endAtUtc) {
      changes.push({
        changeType: "time_changed",
        sourcePerformanceId: inc.sourcePerformanceId,
        performanceId: prev.id,
        before: { startAtUtc: prev.startAtUtc, endAtUtc: prev.endAtUtc },
        after: { startAtUtc: inc.startAtUtc, endAtUtc: inc.endAtUtc },
      });
    }
    if ((prev.stageSourceId ?? "") !== inc.stageSourceId) {
      changes.push({
        changeType: "stage_changed",
        sourcePerformanceId: inc.sourcePerformanceId,
        performanceId: prev.id,
        before: { stageSourceId: prev.stageSourceId },
        after: { stageSourceId: inc.stageSourceId },
      });
    }
    if (!sameSet(prev.artistSourceIds, inc.artistSourceIds)) {
      changes.push({
        changeType: "artist_changed",
        sourcePerformanceId: inc.sourcePerformanceId,
        performanceId: prev.id,
        before: { artistSourceIds: prev.artistSourceIds },
        after: { artistSourceIds: inc.artistSourceIds },
      });
    }
  }

  for (const e of existing) {
    if (e.active && !incomingIds.has(e.sourcePerformanceId)) {
      changes.push({
        changeType: "removed",
        sourcePerformanceId: e.sourcePerformanceId,
        performanceId: e.id,
        before: { stageSourceId: e.stageSourceId, startAtUtc: e.startAtUtc, endAtUtc: e.endAtUtc },
      });
    }
  }

  return changes;
}
