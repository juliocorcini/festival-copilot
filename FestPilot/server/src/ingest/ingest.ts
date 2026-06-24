// Ingestion orchestrator: resolve -> fetch -> detect (hash) -> normalize ->
// diff -> upsert -> record run/changes -> bump revision. Runtime-agnostic and
// dependency-injected so it is unit-tested against an in-memory store + fixtures.

import { buildNormalizedLineup } from "../lineup/normalize";
import type { SourceConfig, SourceStages, SourceWeekendFile } from "../lineup/types";
import { ulid, type IdFactory } from "../db/ids";
import type { Env } from "../env";
import { diffLineup, projectIncoming } from "./diff";
import { sha256Hex } from "./hash";
import { HttpLineupFetcher, type LineupFetcher } from "./source";
import { D1LineupStore, type FestivalIdentity, type LineupStore } from "./store";

export interface IngestDeps {
  fetcher: LineupFetcher;
  store: LineupStore;
  pageUrl: string;
  festival: FestivalIdentity;
  now?: () => Date;
}

export interface IngestResult {
  status: "no_changes" | "updated" | "error";
  festivalId: string;
  changesCount: number;
  revision?: number;
  detail?: string;
  error?: string;
}

export async function ingest(deps: IngestDeps): Promise<IngestResult> {
  const now = deps.now ?? (() => new Date());
  const startedAtUtc = now().toISOString();
  let sourceId: string | null = null;
  let festivalId = "";

  try {
    const payload = await deps.fetcher.fetchLineup(deps.pageUrl);

    // Change detection: hash the raw payloads before parsing/normalizing.
    const configHash = await sha256Hex(payload.configText);
    const stagesHash = await sha256Hex(
      payload.stagesText + payload.weekendTexts.map((w) => w.text).join("")
    );

    festivalId = await deps.store.ensureFestival(deps.festival, now().toISOString());
    sourceId = await deps.store.upsertSource({
      festivalId,
      event: payload.ref.event,
      uuid: payload.ref.uuid,
      pageUrl: deps.pageUrl,
      nowIso: now().toISOString(),
    });

    const last = await deps.store.getLastHashes(sourceId);
    if (last && last.configHash === configHash && last.stagesHash === stagesHash) {
      await deps.store.recordRun({
        sourceId,
        status: "no_changes",
        startedAtUtc,
        finishedAtUtc: now().toISOString(),
        configHash,
        stagesHash,
        changesCount: 0,
      });
      return { status: "no_changes", festivalId, changesCount: 0, detail: "source unchanged" };
    }

    const config = JSON.parse(payload.configText) as SourceConfig;
    const stages = JSON.parse(payload.stagesText) as SourceStages;
    const weekendFiles = payload.weekendTexts.map((w) => ({
      name: w.name,
      file: JSON.parse(w.text) as SourceWeekendFile,
    }));
    const lineup = buildNormalizedLineup({
      event: payload.ref.event,
      uuid: payload.ref.uuid,
      config,
      stages,
      weekendFiles,
    });

    const existing = await deps.store.loadExistingPerformances(festivalId);
    const incoming = projectIncoming(lineup);
    const changes = diffLineup(existing, incoming);

    await deps.store.applyLineup({ festivalId, lineup, nowIso: now().toISOString() });

    const status = changes.length > 0 ? "updated" : "no_changes";
    const runId = await deps.store.recordRun({
      sourceId,
      status,
      startedAtUtc,
      finishedAtUtc: now().toISOString(),
      configHash,
      stagesHash,
      changesCount: changes.length,
    });

    if (changes.length > 0) {
      await deps.store.recordChanges({ runId, changes, nowIso: now().toISOString() });
      const revision = await deps.store.bumpRevision(festivalId, now().toISOString());
      return { status: "updated", festivalId, changesCount: changes.length, revision };
    }

    return {
      status: "no_changes",
      festivalId,
      changesCount: 0,
      detail: "payload changed but no row-level differences",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (sourceId) {
      try {
        await deps.store.recordRun({
          sourceId,
          status: "error",
          startedAtUtc,
          finishedAtUtc: now().toISOString(),
          configHash: null,
          stagesHash: null,
          changesCount: 0,
          error: message,
        });
      } catch {
        // best-effort error logging; never throw from the catch
      }
    }
    return { status: "error", festivalId, changesCount: 0, error: message };
  }
}

/** Build production dependencies (D1 + live HTTP fetch) and run one ingestion. */
export async function runScheduledIngest(
  env: Env,
  fetcher?: LineupFetcher,
  idFactory: IdFactory = ulid
): Promise<IngestResult> {
  const store = new D1LineupStore(env.DB, idFactory);
  const fallbackRef =
    env.LINEUP_EVENT && env.LINEUP_UUID ? { event: env.LINEUP_EVENT, uuid: env.LINEUP_UUID } : null;
  return ingest({
    fetcher: fetcher ?? new HttpLineupFetcher(fetch, undefined, fallbackRef),
    store,
    pageUrl: env.LINEUP_PAGE_URL,
    festival: {
      name: env.FESTIVAL_NAME,
      slug: env.FESTIVAL_SLUG,
      timezone: env.FESTIVAL_TIMEZONE,
    },
  });
}
