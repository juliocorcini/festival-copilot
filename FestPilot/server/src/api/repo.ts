// Read-side data access for the public lineup API. Pure D1 queries -> DTOs.
// No client ever calls the festival site; everything is served from our D1.

import type {
  ArtistDto,
  ArtistSocials,
  FestivalDto,
  FestivalMapDto,
  LineupDto,
  MapTransformDoc,
  PerformanceDto,
  StageDto,
  WeekendDto,
} from "./dto";

/** Parse the stored socials JSON back into an object, omitting it when null/blank/empty. */
function parseSocials(raw: string | null): ArtistSocials | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as ArtistSocials;
    return parsed && typeof parsed === "object" && Object.keys(parsed).length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export interface LineupQuery {
  weekend?: string; // weekend name, e.g. "W1"
  day?: string; // festival day label, e.g. "SATURDAY"
}

interface FestivalRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  revision: number;
  with_timetable: number;
}

const toFestivalDto = (f: FestivalRow): FestivalDto => ({
  id: f.id,
  name: f.name,
  slug: f.slug,
  timezone: f.timezone,
  revision: f.revision,
  withTimetable: f.with_timetable === 1,
});

export async function listFestivals(db: D1Database): Promise<FestivalDto[]> {
  const res = await db
    .prepare(
      `SELECT f.id, f.name, f.slug, f.timezone, f.with_timetable, COALESCE(r.revision, 0) AS revision
         FROM festival f
         LEFT JOIN lineup_revision r ON r.festival_id = f.id
        ORDER BY f.created_at_utc`
    )
    .all<FestivalRow>();
  return (res.results ?? []).map(toFestivalDto);
}

async function getFestival(db: D1Database, festivalId: string): Promise<FestivalDto | null> {
  const f = await db
    .prepare(
      `SELECT f.id, f.name, f.slug, f.timezone, f.with_timetable, COALESCE(r.revision, 0) AS revision
         FROM festival f
         LEFT JOIN lineup_revision r ON r.festival_id = f.id
        WHERE f.id = ?`
    )
    .bind(festivalId)
    .first<FestivalRow>();
  if (!f) return null;
  return toFestivalDto(f);
}

export async function listStages(db: D1Database, festivalId: string): Promise<StageDto[]> {
  const res = await db
    .prepare(
      `SELECT id, source_stage_id, name, sort_order
         FROM stage WHERE festival_id = ? ORDER BY sort_order, name`
    )
    .bind(festivalId)
    .all<{ id: string; source_stage_id: string; name: string; sort_order: number }>();
  return (res.results ?? []).map((s) => ({
    id: s.id,
    sourceStageId: s.source_stage_id,
    name: s.name,
    sortOrder: s.sort_order,
  }));
}

export async function getLineup(
  db: D1Database,
  festivalId: string,
  query: LineupQuery = {}
): Promise<LineupDto | null> {
  const festival = await getFestival(db, festivalId);
  if (!festival) return null;

  const weekendsRes = await db
    .prepare(`SELECT id, name, start_date, end_date FROM weekend WHERE festival_id = ? ORDER BY name`)
    .bind(festivalId)
    .all<{ id: string; name: string; start_date: string | null; end_date: string | null }>();
  const weekends: WeekendDto[] = (weekendsRes.results ?? []).map((w) => ({
    id: w.id,
    name: w.name,
    startDate: w.start_date,
    endDate: w.end_date,
  }));

  const stages = await listStages(db, festivalId);

  const perfRes = await db
    .prepare(
      `SELECT id, source_performance_id, name, day, date_local, weekend_id, stage_id,
              start_at_utc, end_at_utc, is_placeholder
         FROM performance
        WHERE festival_id = ? AND active = 1
        ORDER BY start_at_utc, stage_id`
    )
    .bind(festivalId)
    .all<{
      id: string;
      source_performance_id: string;
      name: string;
      day: string | null;
      date_local: string | null;
      weekend_id: string | null;
      stage_id: string | null;
      start_at_utc: string | null;
      end_at_utc: string | null;
      is_placeholder: number;
    }>();

  const artistRes = await db
    .prepare(
      `SELECT pa.performance_id, a.id, a.name, a.image_url, a.socials, pa.sort_order
         FROM performance_artist pa
         JOIN artist a ON a.id = pa.artist_id
        WHERE pa.performance_id IN (SELECT id FROM performance WHERE festival_id = ? AND active = 1)
        ORDER BY pa.sort_order`
    )
    .bind(festivalId)
    .all<{
      performance_id: string;
      id: string;
      name: string;
      image_url: string | null;
      socials: string | null;
      sort_order: number;
    }>();

  const artistsByPerf = new Map<string, ArtistDto[]>();
  for (const r of artistRes.results ?? []) {
    const list = artistsByPerf.get(r.performance_id) ?? [];
    const artist: ArtistDto = { id: r.id, name: r.name, imageUrl: r.image_url };
    const socials = parseSocials(r.socials);
    if (socials) artist.socials = socials;
    list.push(artist);
    artistsByPerf.set(r.performance_id, list);
  }

  const weekendNameById = new Map(weekends.map((w) => [w.id, w.name]));

  const allPerformances: PerformanceDto[] = (perfRes.results ?? []).map((p) => ({
    id: p.id,
    sourcePerformanceId: p.source_performance_id,
    name: p.name,
    day: p.day,
    dateLocal: p.date_local,
    weekendId: p.weekend_id,
    stageId: p.stage_id,
    startAtUtc: p.start_at_utc,
    endAtUtc: p.end_at_utc,
    isPlaceholder: p.is_placeholder === 1,
    artists: artistsByPerf.get(p.id) ?? [],
  }));

  // Data-state (DEC-052) is derived from the FULL set, never the filtered slice: a real act is
  // announced (hasLineup), and the timetable is published with at least one scheduled set
  // (hasTimetable). `withTimetable=false` means lineup-only even when rows carry placeholder times.
  const hasLineup = allPerformances.some((p) => !p.isPlaceholder && p.artists.length > 0);
  const hasTimetable =
    festival.withTimetable && allPerformances.some((p) => !p.isPlaceholder && p.startAtUtc !== null);

  let performances = allPerformances;
  if (query.weekend) {
    performances = performances.filter((p) => weekendNameById.get(p.weekendId ?? "") === query.weekend);
  }
  if (query.day) {
    performances = performances.filter((p) => p.day === query.day);
  }

  return { festival, weekends, stages, performances, hasLineup, hasTimetable };
}

// ---------------------------------------------------------------------------
// Map (DEC-030/034/040): a static WebP base + the affine transform, recorded per
// festival. URLs are built from stored keys so the same shape serves R2 later.
// ---------------------------------------------------------------------------

export interface FestivalMapInput {
  assetSlug: string;
  baseNightKey: string;
  baseDayKey: string;
  transform: MapTransformDoc;
  revision?: number;
}

/** Build a client URL from a stored asset key. Static keys resolve under the web origin. */
function assetUrl(key: string): string {
  if (/^https?:\/\//.test(key)) return key;
  return key.startsWith("/") ? key : `/${key}`;
}

export async function getFestivalMap(db: D1Database, festivalId: string): Promise<FestivalMapDto | null> {
  const row = await db
    .prepare(
      `SELECT festival_id, asset_slug, base_night_key, base_day_key, transform_json, revision
         FROM festival_map WHERE festival_id = ?`
    )
    .bind(festivalId)
    .first<{
      festival_id: string;
      asset_slug: string;
      base_night_key: string;
      base_day_key: string;
      transform_json: string;
      revision: number;
    }>();
  if (!row) return null;
  return {
    festivalId: row.festival_id,
    assetSlug: row.asset_slug,
    baseNightUrl: assetUrl(row.base_night_key),
    baseDayUrl: assetUrl(row.base_day_key),
    revision: row.revision,
    transform: JSON.parse(row.transform_json) as MapTransformDoc,
  };
}

export async function upsertFestivalMap(
  db: D1Database,
  festivalId: string,
  input: FestivalMapInput,
  nowIso: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO festival_map
         (festival_id, asset_slug, base_night_key, base_day_key, transform_json, revision, updated_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(festival_id) DO UPDATE SET
         asset_slug     = excluded.asset_slug,
         base_night_key = excluded.base_night_key,
         base_day_key   = excluded.base_day_key,
         transform_json = excluded.transform_json,
         revision       = excluded.revision,
         updated_at_utc = excluded.updated_at_utc`
    )
    .bind(
      festivalId,
      input.assetSlug,
      input.baseNightKey,
      input.baseDayKey,
      JSON.stringify(input.transform),
      input.revision ?? 1,
      nowIso
    )
    .run();
}
