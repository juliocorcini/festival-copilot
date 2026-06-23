// Persistence contract for lineup ingestion + the Cloudflare D1 implementation.
// The contract is deliberately small so the orchestrator (ingest.ts) can be unit
// tested against an in-memory fake (see test/), while D1 holds production state.

import type { NormalizedLineup } from "../lineup/types";
import type { IdFactory } from "../db/ids";
import { ulid } from "../db/ids";
import type { ExistingPerformance, LineupChangeRecord } from "./diff";

export interface FestivalIdentity {
  name: string;
  slug: string;
  timezone: string;
}

export interface RecordRunInput {
  sourceId: string;
  status: "no_changes" | "updated" | "error";
  startedAtUtc: string;
  finishedAtUtc: string;
  configHash: string | null;
  stagesHash: string | null;
  changesCount: number;
  error?: string;
}

export interface ApplyResult {
  weekends: number;
  stages: number;
  artists: number;
  performances: number;
}

export interface LineupStore {
  ensureFestival(identity: FestivalIdentity, nowIso: string): Promise<string>;
  upsertSource(input: {
    festivalId: string;
    event: string;
    uuid: string;
    pageUrl: string;
    nowIso: string;
  }): Promise<string>;
  getLastHashes(sourceId: string): Promise<{ configHash: string | null; stagesHash: string | null } | null>;
  loadExistingPerformances(festivalId: string): Promise<ExistingPerformance[]>;
  applyLineup(input: { festivalId: string; lineup: NormalizedLineup; nowIso: string }): Promise<ApplyResult>;
  recordRun(input: RecordRunInput): Promise<string>;
  recordChanges(input: { runId: string; changes: LineupChangeRecord[]; nowIso: string }): Promise<void>;
  bumpRevision(festivalId: string, nowIso: string): Promise<number>;
}

/** Tiny non-crypto hash for per-row change fingerprints (source_hash). */
function fingerprint(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

const BATCH_SIZE = 50;

export class D1LineupStore implements LineupStore {
  constructor(
    private readonly db: D1Database,
    private readonly newId: IdFactory = ulid
  ) {}

  private async runBatch(stmts: D1PreparedStatement[]): Promise<void> {
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
      await this.db.batch(stmts.slice(i, i + BATCH_SIZE));
    }
  }

  async ensureFestival(identity: FestivalIdentity, nowIso: string): Promise<string> {
    const existing = await this.db
      .prepare("SELECT id FROM festival WHERE slug = ?")
      .bind(identity.slug)
      .first<{ id: string }>();
    if (existing) return existing.id;

    const id = this.newId();
    await this.db.batch([
      this.db
        .prepare("INSERT INTO festival (id, name, slug, timezone, created_at_utc) VALUES (?, ?, ?, ?, ?)")
        .bind(id, identity.name, identity.slug, identity.timezone, nowIso),
      this.db
        .prepare("INSERT INTO lineup_revision (festival_id, revision, updated_at_utc) VALUES (?, 0, ?)")
        .bind(id, nowIso),
    ]);
    return id;
  }

  async upsertSource(input: {
    festivalId: string;
    event: string;
    uuid: string;
    pageUrl: string;
    nowIso: string;
  }): Promise<string> {
    const row = await this.db
      .prepare("SELECT id FROM lineup_source WHERE festival_id = ? AND event = ? AND uuid = ?")
      .bind(input.festivalId, input.event, input.uuid)
      .first<{ id: string }>();
    if (row) {
      await this.db
        .prepare("UPDATE lineup_source SET last_seen_at_utc = ?, active = 1 WHERE id = ?")
        .bind(input.nowIso, row.id)
        .run();
      return row.id;
    }
    const id = this.newId();
    await this.db
      .prepare(
        `INSERT INTO lineup_source
           (id, festival_id, event, uuid, source_page_url, first_seen_at_utc, last_seen_at_utc, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(id, input.festivalId, input.event, input.uuid, input.pageUrl, input.nowIso, input.nowIso)
      .run();
    return id;
  }

  async getLastHashes(
    sourceId: string
  ): Promise<{ configHash: string | null; stagesHash: string | null } | null> {
    const row = await this.db
      .prepare(
        `SELECT config_hash, stages_hash
           FROM lineup_import_run
          WHERE source_id = ? AND status != 'error'
          ORDER BY started_at_utc DESC
          LIMIT 1`
      )
      .bind(sourceId)
      .first<{ config_hash: string | null; stages_hash: string | null }>();
    if (!row) return null;
    return { configHash: row.config_hash, stagesHash: row.stages_hash };
  }

  async loadExistingPerformances(festivalId: string): Promise<ExistingPerformance[]> {
    const perfRes = await this.db
      .prepare(
        `SELECT p.id AS id,
                p.source_performance_id AS source_performance_id,
                s.source_stage_id AS stage_source_id,
                p.start_at_utc AS start_at_utc,
                p.end_at_utc AS end_at_utc,
                p.active AS active
           FROM performance p
           LEFT JOIN stage s ON s.id = p.stage_id
          WHERE p.festival_id = ?`
      )
      .bind(festivalId)
      .all<{
        id: string;
        source_performance_id: string;
        stage_source_id: string | null;
        start_at_utc: string | null;
        end_at_utc: string | null;
        active: number;
      }>();

    const artistRes = await this.db
      .prepare(
        `SELECT pa.performance_id AS performance_id, a.source_artist_id AS source_artist_id
           FROM performance_artist pa
           JOIN artist a ON a.id = pa.artist_id
          WHERE pa.performance_id IN (SELECT id FROM performance WHERE festival_id = ?)
          ORDER BY pa.sort_order`
      )
      .bind(festivalId)
      .all<{ performance_id: string; source_artist_id: string }>();

    const artistsByPerf = new Map<string, string[]>();
    for (const r of artistRes.results ?? []) {
      const list = artistsByPerf.get(r.performance_id) ?? [];
      list.push(r.source_artist_id);
      artistsByPerf.set(r.performance_id, list);
    }

    return (perfRes.results ?? []).map((r) => ({
      id: r.id,
      sourcePerformanceId: r.source_performance_id,
      stageSourceId: r.stage_source_id,
      startAtUtc: r.start_at_utc,
      endAtUtc: r.end_at_utc,
      artistSourceIds: artistsByPerf.get(r.id) ?? [],
      active: r.active === 1,
    }));
  }

  async applyLineup(input: {
    festivalId: string;
    lineup: NormalizedLineup;
    nowIso: string;
  }): Promise<ApplyResult> {
    const { festivalId, lineup, nowIso } = input;
    const db = this.db;

    // 1) Resolve source-id -> our-id maps (reuse existing ids; mint for new).
    const weekendMap = await this.loadMap(
      "SELECT id, name AS key FROM weekend WHERE festival_id = ?",
      festivalId
    );
    const stageMap = await this.loadMap(
      "SELECT id, source_stage_id AS key FROM stage WHERE festival_id = ?",
      festivalId
    );
    const perfMap = await this.loadMap(
      "SELECT id, source_performance_id AS key FROM performance WHERE festival_id = ?",
      festivalId
    );
    const artistMap = await this.loadMap("SELECT id, source_artist_id AS key FROM artist", undefined);

    const idFor = (map: Map<string, string>, key: string): string => {
      let id = map.get(key);
      if (!id) {
        id = this.newId();
        map.set(key, id);
      }
      return id;
    };

    const stmts: D1PreparedStatement[] = [];

    // 2) Mark every performance inactive; present ones are reactivated by upsert below.
    stmts.push(
      db.prepare("UPDATE performance SET active = 0 WHERE festival_id = ?").bind(festivalId)
    );

    // 3) Weekends.
    for (const w of lineup.weekends) {
      const id = idFor(weekendMap, w.name);
      stmts.push(
        db
          .prepare(
            `INSERT INTO weekend (id, festival_id, name, start_date, end_date)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(festival_id, name) DO UPDATE SET
               start_date = excluded.start_date, end_date = excluded.end_date`
          )
          .bind(id, festivalId, w.name, w.startDate, w.endDate)
      );
    }

    // 4) Stages.
    lineup.stages.forEach((s, index) => {
      const id = idFor(stageMap, s.sourceId);
      stmts.push(
        db
          .prepare(
            `INSERT INTO stage (id, festival_id, source_stage_id, name, sort_order)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(festival_id, source_stage_id) DO UPDATE SET
               name = excluded.name, sort_order = excluded.sort_order`
          )
          .bind(id, festivalId, s.sourceId, s.name, index)
      );
    });

    // 5) Artists (global, keyed on source_artist_id).
    const artistsSeen = new Map<string, { name: string; image?: string }>();
    for (const p of lineup.performances) {
      for (const a of p.artists) {
        if (!artistsSeen.has(a.id)) artistsSeen.set(a.id, { name: a.name, image: a.image });
      }
    }
    for (const [sourceArtistId, a] of artistsSeen) {
      const id = idFor(artistMap, sourceArtistId);
      stmts.push(
        db
          .prepare(
            `INSERT INTO artist (id, source_artist_id, name, image_url)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(source_artist_id) DO UPDATE SET
               name = excluded.name, image_url = excluded.image_url`
          )
          .bind(id, sourceArtistId, a.name, a.image ?? null)
      );
    }

    // 6) Performances + their artist links.
    const artistLinkStmts: D1PreparedStatement[] = [];
    for (const p of lineup.performances) {
      const id = idFor(perfMap, p.sourceId);
      const weekendId = weekendMap.get(p.weekend) ?? null;
      const stageId = stageMap.get(p.stageId) ?? null;
      const startIso = p.startAt.toISOString();
      const endIso = p.endAt.toISOString();
      const sourceHash = fingerprint(
        `${p.stageId}|${startIso}|${endIso}|${p.artists.map((a) => a.id).join(",")}`
      );
      stmts.push(
        db
          .prepare(
            `INSERT INTO performance
               (id, festival_id, weekend_id, stage_id, source_performance_id, name, day, date_local,
                start_at_utc, end_at_utc, raw_start_time, raw_end_time, is_placeholder, active,
                source_hash, last_imported_at_utc)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
             ON CONFLICT(festival_id, source_performance_id) DO UPDATE SET
               weekend_id = excluded.weekend_id,
               stage_id = excluded.stage_id,
               name = excluded.name,
               day = excluded.day,
               date_local = excluded.date_local,
               start_at_utc = excluded.start_at_utc,
               end_at_utc = excluded.end_at_utc,
               raw_start_time = excluded.raw_start_time,
               raw_end_time = excluded.raw_end_time,
               is_placeholder = excluded.is_placeholder,
               active = 1,
               source_hash = excluded.source_hash,
               last_imported_at_utc = excluded.last_imported_at_utc`
          )
          .bind(
            id,
            festivalId,
            weekendId,
            stageId,
            p.sourceId,
            p.name,
            p.festivalDay,
            p.date,
            startIso,
            endIso,
            p.rawStartTime,
            p.rawEndTime,
            p.isPlaceholder ? 1 : 0,
            sourceHash,
            nowIso
          )
      );

      // Replace artist links for this performance (delete-then-insert is simplest + correct).
      artistLinkStmts.push(
        db.prepare("DELETE FROM performance_artist WHERE performance_id = ?").bind(id)
      );
      p.artists.forEach((a, sortOrder) => {
        const artistId = artistMap.get(a.id)!;
        artistLinkStmts.push(
          db
            .prepare(
              "INSERT INTO performance_artist (performance_id, artist_id, sort_order) VALUES (?, ?, ?)"
            )
            .bind(id, artistId, sortOrder)
        );
      });
    }

    // Order matters (artists before links; performances before links). runBatch keeps order.
    await this.runBatch([...stmts, ...artistLinkStmts]);

    return {
      weekends: lineup.weekends.length,
      stages: lineup.stages.length,
      artists: artistsSeen.size,
      performances: lineup.performances.length,
    };
  }

  async recordRun(input: RecordRunInput): Promise<string> {
    const id = this.newId();
    await this.db
      .prepare(
        `INSERT INTO lineup_import_run
           (id, source_id, status, started_at_utc, finished_at_utc, config_hash, stages_hash, changes_count, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.sourceId,
        input.status,
        input.startedAtUtc,
        input.finishedAtUtc,
        input.configHash,
        input.stagesHash,
        input.changesCount,
        input.error ?? null
      )
      .run();
    return id;
  }

  async recordChanges(input: { runId: string; changes: LineupChangeRecord[]; nowIso: string }): Promise<void> {
    const stmts = input.changes.map((c) =>
      this.db
        .prepare(
          `INSERT INTO lineup_change
             (id, import_run_id, performance_id, change_type, before_json, after_json, detected_at_utc)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          this.newId(),
          input.runId,
          c.performanceId ?? null,
          c.changeType,
          c.before === undefined ? null : JSON.stringify(c.before),
          c.after === undefined ? null : JSON.stringify(c.after),
          input.nowIso
        )
    );
    await this.runBatch(stmts);
  }

  async bumpRevision(festivalId: string, nowIso: string): Promise<number> {
    await this.db
      .prepare("UPDATE lineup_revision SET revision = revision + 1, updated_at_utc = ? WHERE festival_id = ?")
      .bind(nowIso, festivalId)
      .run();
    const row = await this.db
      .prepare("SELECT revision FROM lineup_revision WHERE festival_id = ?")
      .bind(festivalId)
      .first<{ revision: number }>();
    return row?.revision ?? 0;
  }

  /** Load a `key -> id` map from a query selecting `id` + aliased `key`. */
  private async loadMap(sql: string, bind?: string): Promise<Map<string, string>> {
    const stmt = bind === undefined ? this.db.prepare(sql) : this.db.prepare(sql).bind(bind);
    const res = await stmt.all<{ id: string; key: string }>();
    const map = new Map<string, string>();
    for (const r of res.results ?? []) map.set(r.key, r.id);
    return map;
  }
}
