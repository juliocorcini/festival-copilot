// In-memory LineupStore for orchestration tests. Mirrors the D1 store's
// observable semantics: stable ids across runs, mark-removed-as-inactive,
// latest-run hashes for change detection, revision counter.

import type { ExistingPerformance } from "../src/ingest/diff";
import type {
  ApplyResult,
  FestivalIdentity,
  LineupStore,
  RecordRunInput,
} from "../src/ingest/store";
import type { NormalizedLineup } from "../src/lineup/types";
import type { LineupChangeRecord } from "../src/ingest/diff";

interface StoredPerf {
  id: string;
  stageSourceId: string;
  startAtUtc: string;
  endAtUtc: string;
  artistSourceIds: string[];
  active: boolean;
}

export class InMemoryLineupStore implements LineupStore {
  readonly festivalsBySlug = new Map<string, string>();
  readonly revisions = new Map<string, number>();
  readonly sources = new Map<string, string>();
  readonly runs: RecordRunInput[] = [];
  readonly perfs = new Map<string, StoredPerf>();
  readonly changeLog: LineupChangeRecord[] = [];
  private seq = 0;

  private nextId(prefix: string): string {
    return `${prefix}_${++this.seq}`;
  }

  async ensureFestival(identity: FestivalIdentity, _nowIso: string): Promise<string> {
    let id = this.festivalsBySlug.get(identity.slug);
    if (!id) {
      id = this.nextId("fest");
      this.festivalsBySlug.set(identity.slug, id);
      this.revisions.set(id, 0);
    }
    return id;
  }

  async upsertSource(input: {
    festivalId: string;
    event: string;
    uuid: string;
    pageUrl: string;
    nowIso: string;
  }): Promise<string> {
    const key = `${input.festivalId}:${input.event}:${input.uuid}`;
    let id = this.sources.get(key);
    if (!id) {
      id = this.nextId("src");
      this.sources.set(key, id);
    }
    return id;
  }

  async getLastHashes(
    sourceId: string
  ): Promise<{ configHash: string | null; stagesHash: string | null } | null> {
    for (let i = this.runs.length - 1; i >= 0; i--) {
      const r = this.runs[i]!;
      if (r.sourceId === sourceId && r.status !== "error") {
        return { configHash: r.configHash, stagesHash: r.stagesHash };
      }
    }
    return null;
  }

  async loadExistingPerformances(_festivalId: string): Promise<ExistingPerformance[]> {
    return [...this.perfs.entries()].map(([sourcePerformanceId, v]) => ({
      id: v.id,
      sourcePerformanceId,
      stageSourceId: v.stageSourceId,
      startAtUtc: v.startAtUtc,
      endAtUtc: v.endAtUtc,
      artistSourceIds: v.artistSourceIds,
      active: v.active,
    }));
  }

  async applyLineup(input: {
    festivalId: string;
    lineup: NormalizedLineup;
    nowIso: string;
  }): Promise<ApplyResult> {
    const { lineup } = input;
    const incomingIds = new Set(lineup.performances.map((p) => p.sourceId));
    for (const [sourceId, v] of this.perfs) {
      if (!incomingIds.has(sourceId)) v.active = false;
    }
    for (const p of lineup.performances) {
      const existing = this.perfs.get(p.sourceId);
      this.perfs.set(p.sourceId, {
        id: existing?.id ?? this.nextId("perf"),
        stageSourceId: p.stageId,
        startAtUtc: p.startAt.toISOString(),
        endAtUtc: p.endAt.toISOString(),
        artistSourceIds: p.artists.map((a) => a.id),
        active: true,
      });
    }
    return {
      weekends: lineup.weekends.length,
      stages: lineup.stages.length,
      artists: 0,
      performances: lineup.performances.length,
    };
  }

  async recordRun(input: RecordRunInput): Promise<string> {
    this.runs.push(input);
    return this.nextId("run");
  }

  async recordChanges(input: { runId: string; changes: LineupChangeRecord[]; nowIso: string }): Promise<void> {
    this.changeLog.push(...input.changes);
  }

  async bumpRevision(festivalId: string, _nowIso: string): Promise<number> {
    const next = (this.revisions.get(festivalId) ?? 0) + 1;
    this.revisions.set(festivalId, next);
    return next;
  }
}
