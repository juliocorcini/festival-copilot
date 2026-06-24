// R11.2 (DEC-057a): per-festival data-source registry. The operator-curated record of WHERE a
// festival's data comes from and HOW it's captured, with a manual path for festivals without a
// clean official source. Distinct from the operational `lineup_source` the ingester writes — we
// surface that as a read-only "operational" reference so the registry can be checked against reality.

export const DATA_SOURCE_ORIGINS = ["official_page", "manual", "ai_assisted"] as const;
export type DataSourceOrigin = (typeof DATA_SOURCE_ORIGINS)[number];

export function isDataSourceOrigin(v: unknown): v is DataSourceOrigin {
  return typeof v === "string" && (DATA_SOURCE_ORIGINS as readonly string[]).includes(v);
}

export interface OperationalSource {
  event: string;
  uuid: string;
  pageUrl: string;
  lastSeenUtc: string;
}

export interface DataSourceDto {
  festivalId: string;
  origin: DataSourceOrigin;
  pageUrl: string | null;
  event: string | null;
  uuid: string | null;
  captureMethod: string | null;
  notes: string | null;
  aiReaderEnabled: boolean;
  /** Null until an operator saves the registry record (the rest may be seeded from operational). */
  updatedAtUtc: string | null;
  /** What the ingester is actually using right now (read-only), if any. */
  operational: OperationalSource | null;
}

export interface DataSourceInput {
  origin: DataSourceOrigin;
  pageUrl: string | null;
  event: string | null;
  uuid: string | null;
  captureMethod: string | null;
  notes: string | null;
  aiReaderEnabled: boolean;
}

interface RegistryRow {
  origin: string;
  page_url: string | null;
  event: string | null;
  uuid: string | null;
  capture_method: string | null;
  notes: string | null;
  ai_reader_enabled: number;
  updated_at_utc: string;
}

async function getOperationalSource(db: D1Database, festivalId: string): Promise<OperationalSource | null> {
  const row = await db
    .prepare(
      `SELECT event, uuid, source_page_url, last_seen_at_utc
         FROM lineup_source WHERE festival_id = ? AND active = 1
        ORDER BY last_seen_at_utc DESC LIMIT 1`
    )
    .bind(festivalId)
    .first<{ event: string; uuid: string; source_page_url: string; last_seen_at_utc: string }>();
  return row ? { event: row.event, uuid: row.uuid, pageUrl: row.source_page_url, lastSeenUtc: row.last_seen_at_utc } : null;
}

/**
 * The registry record for a festival. When no operator record exists yet, returns an honest default
 * pre-filled from the operational source (so the screen reflects reality), with updatedAtUtc=null.
 */
export async function getDataSource(db: D1Database, festivalId: string): Promise<DataSourceDto> {
  const [row, operational] = await Promise.all([
    db
      .prepare(
        `SELECT origin, page_url, event, uuid, capture_method, notes, ai_reader_enabled, updated_at_utc
           FROM festival_data_source WHERE festival_id = ?`
      )
      .bind(festivalId)
      .first<RegistryRow>(),
    getOperationalSource(db, festivalId),
  ]);

  if (!row) {
    return {
      festivalId,
      origin: "official_page",
      pageUrl: operational?.pageUrl ?? null,
      event: operational?.event ?? null,
      uuid: operational?.uuid ?? null,
      captureMethod: operational ? "Official page → resolve event+uuid → CDN JSON (DEC-009)" : null,
      notes: null,
      aiReaderEnabled: false,
      updatedAtUtc: null,
      operational,
    };
  }

  return {
    festivalId,
    origin: isDataSourceOrigin(row.origin) ? row.origin : "manual",
    pageUrl: row.page_url,
    event: row.event,
    uuid: row.uuid,
    captureMethod: row.capture_method,
    notes: row.notes,
    aiReaderEnabled: row.ai_reader_enabled === 1,
    updatedAtUtc: row.updated_at_utc,
    operational,
  };
}

export async function upsertDataSource(
  db: D1Database,
  festivalId: string,
  input: DataSourceInput,
  nowIso: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO festival_data_source
         (festival_id, origin, page_url, event, uuid, capture_method, notes, ai_reader_enabled, updated_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(festival_id) DO UPDATE SET
         origin            = excluded.origin,
         page_url          = excluded.page_url,
         event             = excluded.event,
         uuid              = excluded.uuid,
         capture_method    = excluded.capture_method,
         notes             = excluded.notes,
         ai_reader_enabled = excluded.ai_reader_enabled,
         updated_at_utc    = excluded.updated_at_utc`
    )
    .bind(
      festivalId,
      input.origin,
      input.pageUrl,
      input.event,
      input.uuid,
      input.captureMethod,
      input.notes,
      input.aiReaderEnabled ? 1 : 0,
      nowIso
    )
    .run();
}

/** Coerce a raw request body into a validated DataSourceInput (trims, length-caps, default origin). */
export function readDataSourceInput(body: Record<string, unknown> | null): DataSourceInput {
  const str = (v: unknown, max: number): string | null =>
    typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null;
  return {
    origin: isDataSourceOrigin(body?.origin) ? body.origin : "manual",
    pageUrl: str(body?.pageUrl, 400),
    event: str(body?.event, 80),
    uuid: str(body?.uuid, 120),
    captureMethod: str(body?.captureMethod, 400),
    notes: str(body?.notes, 1000),
    aiReaderEnabled: body?.aiReaderEnabled === true,
  };
}
