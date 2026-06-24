// Read-side data access for the admin back-office (R11 / DEC-057). Pure D1 queries -> admin DTOs.
// Kept separate from the public `repo.ts` so the operator views never leak into the festival-goer API.

export interface AdminFestivalRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  revision: number;
  withTimetable: boolean;
  stageCount: number;
  /** Active, non-placeholder performances (the real announced sets). */
  performanceCount: number;
  /** Of those, how many carry a real start time (a published timetable). */
  scheduledCount: number;
  hasMap: boolean;
}

export interface AdminOverview {
  totals: { festivals: number; stages: number; performances: number; scheduled: number };
  festivals: AdminFestivalRow[];
}

/**
 * One overview snapshot for the Festivals screen: per-festival health + global KPIs. A handful of
 * grouped aggregates (not N+1) keep it to four queries regardless of festival count
 * (software-engineering-guidelines §2.5).
 */
export async function getAdminOverview(db: D1Database): Promise<AdminOverview> {
  const [festivals, stages, perfs, maps] = await Promise.all([
    db
      .prepare(
        `SELECT f.id, f.name, f.slug, f.timezone, f.with_timetable,
                COALESCE(r.revision, 0) AS revision
           FROM festival f
           LEFT JOIN lineup_revision r ON r.festival_id = f.id
          ORDER BY f.created_at_utc`
      )
      .all<{ id: string; name: string; slug: string; timezone: string; with_timetable: number; revision: number }>(),
    db
      .prepare(`SELECT festival_id, COUNT(*) AS c FROM stage GROUP BY festival_id`)
      .all<{ festival_id: string; c: number }>(),
    db
      .prepare(
        `SELECT festival_id,
                SUM(CASE WHEN is_placeholder = 0 THEN 1 ELSE 0 END) AS performances,
                SUM(CASE WHEN is_placeholder = 0 AND start_at_utc IS NOT NULL THEN 1 ELSE 0 END) AS scheduled
           FROM performance WHERE active = 1 GROUP BY festival_id`
      )
      .all<{ festival_id: string; performances: number; scheduled: number }>(),
    db.prepare(`SELECT festival_id FROM festival_map`).all<{ festival_id: string }>(),
  ]);

  const stageByFest = new Map((stages.results ?? []).map((r) => [r.festival_id, r.c]));
  const perfByFest = new Map((perfs.results ?? []).map((r) => [r.festival_id, r]));
  const mapFests = new Set((maps.results ?? []).map((r) => r.festival_id));

  const rows: AdminFestivalRow[] = (festivals.results ?? []).map((f) => {
    const perf = perfByFest.get(f.id);
    return {
      id: f.id,
      name: f.name,
      slug: f.slug,
      timezone: f.timezone,
      revision: f.revision,
      withTimetable: f.with_timetable === 1,
      stageCount: stageByFest.get(f.id) ?? 0,
      performanceCount: perf?.performances ?? 0,
      scheduledCount: perf?.scheduled ?? 0,
      hasMap: mapFests.has(f.id),
    };
  });

  return {
    totals: {
      festivals: rows.length,
      stages: rows.reduce((n, r) => n + r.stageCount, 0),
      performances: rows.reduce((n, r) => n + r.performanceCount, 0),
      scheduled: rows.reduce((n, r) => n + r.scheduledCount, 0),
    },
    festivals: rows,
  };
}

// ---------------------------------------------------------------------------
// R11.1b — Lineup & timetable dashboard: the documented capture source + per-stage
// health (counts per day, first/last set, scheduled-vs-announced) for one festival.
// ---------------------------------------------------------------------------

export interface LineupSourceInfo {
  event: string;
  uuid: string;
  sourcePageUrl: string;
  lastSeenUtc: string;
}

export interface LineupStageRow {
  id: string;
  name: string;
  total: number;
  scheduled: number;
  countsByDay: Record<string, number>;
  firstStartUtc: string | null;
  lastStartUtc: string | null;
}

export interface LineupDashboard {
  festival: { id: string; name: string; slug: string; timezone: string; withTimetable: boolean };
  source: LineupSourceInfo | null;
  days: string[];
  stages: LineupStageRow[];
  needsEndTime: number;
  totals: { sets: number; scheduled: number; stages: number };
}

interface DayCountRow {
  stage_id: string | null;
  day: string | null;
  sets: number;
  scheduled: number;
  first_start: string | null;
  last_start: string | null;
}

export async function getLineupDashboard(
  db: D1Database,
  festivalId: string
): Promise<LineupDashboard | null> {
  const festival = await db
    .prepare(`SELECT id, name, slug, timezone, with_timetable FROM festival WHERE id = ?`)
    .bind(festivalId)
    .first<{ id: string; name: string; slug: string; timezone: string; with_timetable: number }>();
  if (!festival) return null;

  const [stages, counts, ends, source] = await Promise.all([
    db
      .prepare(`SELECT id, name FROM stage WHERE festival_id = ? ORDER BY sort_order, name`)
      .bind(festivalId)
      .all<{ id: string; name: string }>(),
    db
      .prepare(
        `SELECT stage_id, day,
                COUNT(*) AS sets,
                SUM(CASE WHEN start_at_utc IS NOT NULL THEN 1 ELSE 0 END) AS scheduled,
                MIN(start_at_utc) AS first_start,
                MAX(start_at_utc) AS last_start
           FROM performance
          WHERE festival_id = ? AND active = 1 AND is_placeholder = 0
          GROUP BY stage_id, day`
      )
      .bind(festivalId)
      .all<DayCountRow>(),
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM performance
          WHERE festival_id = ? AND active = 1 AND is_placeholder = 0
            AND start_at_utc IS NOT NULL AND end_at_utc IS NULL`
      )
      .bind(festivalId)
      .first<{ c: number }>(),
    db
      .prepare(
        `SELECT event, uuid, source_page_url, last_seen_at_utc
           FROM lineup_source WHERE festival_id = ? AND active = 1
          ORDER BY last_seen_at_utc DESC LIMIT 1`
      )
      .bind(festivalId)
      .first<{ event: string; uuid: string; source_page_url: string; last_seen_at_utc: string }>(),
  ]);

  // Order the day labels by their earliest set (a festival day can cross midnight; null days drop out).
  const dayFirst = new Map<string, string>();
  for (const r of counts.results ?? []) {
    if (!r.day || !r.first_start) continue;
    const prev = dayFirst.get(r.day);
    if (!prev || r.first_start < prev) dayFirst.set(r.day, r.first_start);
  }
  const days = [...dayFirst.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([d]) => d);

  const byStage = new Map<string, LineupStageRow>();
  for (const s of stages.results ?? []) {
    byStage.set(s.id, { id: s.id, name: s.name, total: 0, scheduled: 0, countsByDay: {}, firstStartUtc: null, lastStartUtc: null });
  }
  for (const r of counts.results ?? []) {
    if (!r.stage_id) continue;
    const row = byStage.get(r.stage_id);
    if (!row) continue;
    row.total += r.sets;
    row.scheduled += r.scheduled;
    if (r.day) row.countsByDay[r.day] = (row.countsByDay[r.day] ?? 0) + r.sets;
    if (r.first_start && (!row.firstStartUtc || r.first_start < row.firstStartUtc)) row.firstStartUtc = r.first_start;
    if (r.last_start && (!row.lastStartUtc || r.last_start > row.lastStartUtc)) row.lastStartUtc = r.last_start;
  }
  const stageRows = [...byStage.values()];

  return {
    festival: {
      id: festival.id,
      name: festival.name,
      slug: festival.slug,
      timezone: festival.timezone,
      withTimetable: festival.with_timetable === 1,
    },
    source: source
      ? { event: source.event, uuid: source.uuid, sourcePageUrl: source.source_page_url, lastSeenUtc: source.last_seen_at_utc }
      : null,
    days,
    stages: stageRows,
    needsEndTime: ends?.c ?? 0,
    totals: {
      sets: stageRows.reduce((n, r) => n + r.total, 0),
      scheduled: stageRows.reduce((n, r) => n + r.scheduled, 0),
      stages: stageRows.length,
    },
  };
}
