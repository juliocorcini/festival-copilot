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
