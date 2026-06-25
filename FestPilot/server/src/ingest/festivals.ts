// Festival registry: onboard a new festival + drive multi-festival ingestion (R11.1c / DEC-063).
//
// "Add a festival" = register its official lineup page and run the EXISTING parametric `ingest()`
// against it (resolve the source ref from the page → fetch the CDN files → normalize → diff →
// upsert). No new scraper, no hardcoded lineup (DEC-009/061): a new festival is ingested exactly
// like the seed one. The scheduled cron then iterates every registered source, bootstrapping from
// the env-var seed only while the registry is empty (first deploy).

import { ulid, type IdFactory } from "../db/ids";
import type { Env } from "../env";
import { ingest, runScheduledIngest, type IngestResult } from "./ingest";
import { HttpLineupFetcher, type LineupFetcher } from "./source";
import { D1LineupStore } from "./store";

export interface OnboardFestivalInput {
  name: string;
  slug: string;
  timezone: string;
  pageUrl: string;
  /** Optional saved source ref — used only if the page can't be resolved (WAF 403). */
  event?: string;
  uuid?: string;
}

export interface FestivalMetaPatch {
  name?: string;
  timezone?: string;
}

/** One festival to (re-)ingest: its identity + the latest active source page. */
export interface IngestTarget {
  festivalId: string;
  name: string;
  slug: string;
  timezone: string;
  pageUrl: string;
  event: string | null;
  uuid: string | null;
}

// ---------------------------------------------------------------------------
// Input validation (kept pure so it is unit-testable without a DB).
// ---------------------------------------------------------------------------

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Lowercase, hyphenate, strip anything that isn't url-safe. Empty in → empty out. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A timezone is valid if the runtime can build a formatter for it (IANA name). */
export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Validate + normalize the "add festival" payload. Slug is derived from the name when omitted. */
export function readOnboardInput(body: unknown): ValidationResult<OnboardFestivalInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const timezone = typeof b.timezone === "string" ? b.timezone.trim() : "";
  const pageUrl = typeof b.pageUrl === "string" ? b.pageUrl.trim() : "";
  const slugRaw = typeof b.slug === "string" && b.slug.trim() ? b.slug : name;
  const slug = normalizeSlug(slugRaw);
  const event = typeof b.event === "string" && b.event.trim() ? b.event.trim() : undefined;
  const uuid = typeof b.uuid === "string" && b.uuid.trim() ? b.uuid.trim() : undefined;

  if (!name) return { ok: false, error: "name is required" };
  if (!slug) return { ok: false, error: "slug is required (could not derive one from the name)" };
  if (!timezone || !isValidTimezone(timezone)) return { ok: false, error: "a valid IANA timezone is required" };
  if (!pageUrl || !isHttpUrl(pageUrl)) return { ok: false, error: "a valid official lineup page URL is required" };
  // event + uuid are paired: a saved ref needs both halves to be usable.
  if ((event && !uuid) || (uuid && !event)) {
    return { ok: false, error: "event and uuid must be provided together" };
  }

  return { ok: true, value: { name, slug, timezone, pageUrl, event, uuid } };
}

/** Validate the festival metadata edit (rename / fix timezone). */
export function readMetaPatch(body: unknown): ValidationResult<FestivalMetaPatch> {
  const b = (body ?? {}) as Record<string, unknown>;
  const patch: FestivalMetaPatch = {};
  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return { ok: false, error: "name cannot be empty" };
    patch.name = name;
  }
  if (b.timezone !== undefined) {
    const tz = typeof b.timezone === "string" ? b.timezone.trim() : "";
    if (!tz || !isValidTimezone(tz)) return { ok: false, error: "a valid IANA timezone is required" };
    patch.timezone = tz;
  }
  if (patch.name === undefined && patch.timezone === undefined) {
    return { ok: false, error: "nothing to update (provide name and/or timezone)" };
  }
  return { ok: true, value: patch };
}

// ---------------------------------------------------------------------------
// Registry reads / writes.
// ---------------------------------------------------------------------------

/** True if a festival with this slug already exists (so "add" can refuse a duplicate). */
export async function festivalSlugExists(db: D1Database, slug: string): Promise<boolean> {
  const row = await db.prepare("SELECT 1 AS x FROM festival WHERE slug = ?").bind(slug).first<{ x: number }>();
  return !!row;
}

/** Update editable festival metadata. Returns false if the festival doesn't exist. */
export async function updateFestivalMeta(db: D1Database, id: string, patch: FestivalMetaPatch): Promise<boolean> {
  const sets: string[] = [];
  const binds: string[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    binds.push(patch.name);
  }
  if (patch.timezone !== undefined) {
    sets.push("timezone = ?");
    binds.push(patch.timezone);
  }
  if (sets.length === 0) return false;
  const res = await db
    .prepare(`UPDATE festival SET ${sets.join(", ")} WHERE id = ?`)
    .bind(...binds, id)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/**
 * Every festival to (re-)ingest: one row per festival = its latest active source page.
 * A correlated subquery picks the most-recently-seen active source so a uuid change is
 * followed without duplicating the festival.
 */
export async function listIngestTargets(db: D1Database): Promise<IngestTarget[]> {
  const res = await db
    .prepare(
      `SELECT f.id AS festivalId, f.name AS name, f.slug AS slug, f.timezone AS timezone,
              ls.source_page_url AS pageUrl, ls.event AS event, ls.uuid AS uuid
         FROM festival f
         JOIN lineup_source ls ON ls.id = (
              SELECT id FROM lineup_source
               WHERE festival_id = f.id AND active = 1
               ORDER BY last_seen_at_utc DESC LIMIT 1)
        ORDER BY f.created_at_utc`
    )
    .all<IngestTarget>();
  return res.results ?? [];
}

/** The single ingest target for one festival (its latest active source), or null if none registered. */
export async function getIngestTarget(db: D1Database, festivalId: string): Promise<IngestTarget | null> {
  const row = await db
    .prepare(
      `SELECT f.id AS festivalId, f.name AS name, f.slug AS slug, f.timezone AS timezone,
              ls.source_page_url AS pageUrl, ls.event AS event, ls.uuid AS uuid
         FROM festival f
         JOIN lineup_source ls ON ls.id = (
              SELECT id FROM lineup_source
               WHERE festival_id = f.id AND active = 1
               ORDER BY last_seen_at_utc DESC LIMIT 1)
        WHERE f.id = ?`
    )
    .bind(festivalId)
    .first<IngestTarget>();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Ingestion orchestration (reuses the parametric ingest()).
// ---------------------------------------------------------------------------

function fetcherFor(event: string | null | undefined, uuid: string | null | undefined): HttpLineupFetcher {
  const fallbackRef = event && uuid ? { event, uuid } : null;
  return new HttpLineupFetcher(fetch, undefined, fallbackRef);
}

/**
 * Onboard a new festival from its official lineup page (the admin "Add festival" action).
 * `fetcher` is injectable for tests; production resolves the source ref live from the page.
 */
export async function onboardFestival(
  env: Env,
  input: OnboardFestivalInput,
  fetcher?: LineupFetcher,
  idFactory: IdFactory = ulid
): Promise<IngestResult> {
  const store = new D1LineupStore(env.DB, idFactory);
  return ingest({
    fetcher: fetcher ?? fetcherFor(input.event, input.uuid),
    store,
    pageUrl: input.pageUrl,
    festival: { name: input.name, slug: input.slug, timezone: input.timezone },
  });
}

/** Re-ingest one already-registered festival (the per-festival "Re-import" action). */
export async function ingestFestival(
  env: Env,
  target: IngestTarget,
  fetcher?: LineupFetcher,
  idFactory: IdFactory = ulid
): Promise<IngestResult> {
  const store = new D1LineupStore(env.DB, idFactory);
  return ingest({
    fetcher: fetcher ?? fetcherFor(target.event, target.uuid),
    store,
    pageUrl: target.pageUrl,
    festival: { name: target.name, slug: target.slug, timezone: target.timezone },
  });
}

/**
 * Cron / "re-import all" entry: ingest every registered festival sequentially (independent D1
 * writes share the global `artist` table, so we don't parallelize them). Falls back to the
 * env-var seed while the registry is still empty, preserving the original single-festival behavior.
 */
export async function ingestAllFestivals(
  env: Env,
  fetcher?: LineupFetcher,
  idFactory: IdFactory = ulid
): Promise<IngestResult[]> {
  const targets = await listIngestTargets(env.DB);
  if (targets.length === 0) {
    return [await runScheduledIngest(env, fetcher, idFactory)];
  }
  const results: IngestResult[] = [];
  for (const target of targets) {
    results.push(await ingestFestival(env, target, fetcher, idFactory));
  }
  return results;
}
