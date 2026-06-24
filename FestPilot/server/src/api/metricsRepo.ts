// R11.4 (DEC-057c): admin usage metrics + free-tier runway. Everything here is REAL first-party
// data — real users (app_user, DEC-060), real R2 bytes (media ledger, DEC-059), and our own daily
// touch counter — never mocked. Synthetic R11.5 test users (is_test=1) are excluded from every
// real count. Exact platform consumption (Workers/D1/Durable Objects) is reported as "locked" until
// a Cloudflare Analytics token is configured, rather than fabricated.

import {
  estimateRunway,
  FREE_TIER_SERVICES,
  GIB,
  type LimitKind,
  type RunwayEstimate,
} from "./runway";

const ACTIVITY_KIND = "me_touch";
const WINDOW_DAYS = 7;

export interface UsersSummary {
  total: number;
  named: number;
  withEmail: number;
  anonymous: number;
  activeLast7d: number;
  newLast7d: number;
  testUsers: number;
  byCountry: { country: string; count: number }[];
  recent: { displayName: string | null; country: string | null; hasEmail: boolean; lastSeenUtc: string | null }[];
}

export interface StorageUsage {
  objectCount: number;
  totalBytes: number;
  bytesLast7d: number;
  objectsLast7d: number;
}

export interface ActivitySummary {
  kind: string;
  today: number;
  avgPerDay: number;
  series: { day: string; count: number }[];
}

export interface ServiceRunway extends RunwayEstimate {
  id: string;
  label: string;
  used: number;
  ceiling: number;
  unit: "bytes" | "count";
  kind: LimitKind;
  firstParty: boolean;
  note: string;
}

export interface LockedService {
  id: string;
  label: string;
  ceiling: number;
  unit: "bytes" | "count";
  note: string;
}

export interface MetricsDto {
  users: UsersSummary;
  storage: StorageUsage;
  activity: ActivitySummary;
  runways: ServiceRunway[];
  locked: LockedService[];
  generatedAtUtc: string;
}

const dayKey = (iso: string): string => iso.slice(0, 10);

function daysAgoIso(nowIso: string, days: number): string {
  return new Date(new Date(nowIso).getTime() - days * 86_400_000).toISOString();
}

/** Increment today's first-party counter for `kind` (one row per kind per UTC day). */
export async function recordUsage(db: D1Database, kind: string, nowIso: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO usage_counter (day, kind, count) VALUES (?, ?, 1)
       ON CONFLICT(day, kind) DO UPDATE SET count = count + 1`
    )
    .bind(dayKey(nowIso), kind)
    .run();
}

async function getUsersSummary(db: D1Database, nowIso: string): Promise<UsersSummary> {
  const cutoff = daysAgoIso(nowIso, WINDOW_DAYS);
  const [totals, countries, recent, testCount] = await Promise.all([
    db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN display_name IS NOT NULL AND display_name <> '' THEN 1 ELSE 0 END) AS named,
           SUM(CASE WHEN email IS NOT NULL AND email <> '' THEN 1 ELSE 0 END) AS with_email,
           SUM(CASE WHEN is_anonymous = 1 THEN 1 ELSE 0 END) AS anonymous,
           SUM(CASE WHEN last_seen_utc >= ? THEN 1 ELSE 0 END) AS active7,
           SUM(CASE WHEN created_at_utc >= ? THEN 1 ELSE 0 END) AS new7
         FROM app_user WHERE is_test = 0`
      )
      .bind(cutoff, cutoff)
      .first<Record<string, number>>(),
    db
      .prepare(
        `SELECT country, COUNT(*) AS count FROM app_user
          WHERE is_test = 0 AND country IS NOT NULL AND country <> ''
          GROUP BY country ORDER BY count DESC, country LIMIT 8`
      )
      .all<{ country: string; count: number }>(),
    db
      .prepare(
        `SELECT display_name, country, email, last_seen_utc FROM app_user
          WHERE is_test = 0 ORDER BY last_seen_utc DESC NULLS LAST LIMIT 8`
      )
      .all<{ display_name: string | null; country: string | null; email: string | null; last_seen_utc: string | null }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM app_user WHERE is_test = 1`).first<{ c: number }>(),
  ]);

  return {
    total: Number(totals?.total ?? 0),
    named: Number(totals?.named ?? 0),
    withEmail: Number(totals?.with_email ?? 0),
    anonymous: Number(totals?.anonymous ?? 0),
    activeLast7d: Number(totals?.active7 ?? 0),
    newLast7d: Number(totals?.new7 ?? 0),
    testUsers: Number(testCount?.c ?? 0),
    byCountry: (countries.results ?? []).map((r) => ({ country: r.country, count: Number(r.count) })),
    recent: (recent.results ?? []).map((r) => ({
      displayName: r.display_name,
      country: r.country,
      hasEmail: !!r.email,
      lastSeenUtc: r.last_seen_utc,
    })),
  };
}

async function getStorageUsage(db: D1Database, nowIso: string): Promise<StorageUsage> {
  const cutoff = daysAgoIso(nowIso, WINDOW_DAYS);
  const [totals, recent] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(byte_size), 0) AS b FROM media_object`).first<{ n: number; b: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(byte_size), 0) AS b FROM media_object WHERE created_at_utc >= ?`)
      .bind(cutoff)
      .first<{ n: number; b: number }>(),
  ]);
  return {
    objectCount: Number(totals?.n ?? 0),
    totalBytes: Number(totals?.b ?? 0),
    objectsLast7d: Number(recent?.n ?? 0),
    bytesLast7d: Number(recent?.b ?? 0),
  };
}

async function getActivity(db: D1Database, nowIso: string): Promise<ActivitySummary> {
  const cutoff = daysAgoIso(nowIso, WINDOW_DAYS);
  const rows = await db
    .prepare(`SELECT day, count FROM usage_counter WHERE kind = ? AND day >= ? ORDER BY day`)
    .bind(ACTIVITY_KIND, dayKey(cutoff))
    .all<{ day: string; count: number }>();
  const series = (rows.results ?? []).map((r) => ({ day: r.day, count: Number(r.count) }));
  const total = series.reduce((sum, r) => sum + r.count, 0);
  const today = series.find((r) => r.day === dayKey(nowIso))?.count ?? 0;
  const avgPerDay = series.length > 0 ? Math.round(total / series.length) : 0;
  return { kind: ACTIVITY_KIND, today, avgPerDay, series };
}

/** Orchestrate every real signal into the admin metrics payload, including the runway estimates. */
export async function getMetrics(db: D1Database, nowIso: string): Promise<MetricsDto> {
  const [users, storage, activity] = await Promise.all([
    getUsersSummary(db, nowIso),
    getStorageUsage(db, nowIso),
    getActivity(db, nowIso),
  ]);

  const byId = (id: string) => FREE_TIER_SERVICES.find((s) => s.id === id)!;

  const r2 = byId("r2_storage");
  const r2Runway: ServiceRunway = {
    id: r2.id,
    label: r2.label,
    used: storage.totalBytes,
    ceiling: r2.ceiling,
    unit: r2.unit,
    kind: r2.kind,
    firstParty: r2.firstParty,
    note: r2.note,
    ...estimateRunway({ used: storage.totalBytes, ceiling: r2.ceiling, perDayRate: storage.bytesLast7d / WINDOW_DAYS, kind: r2.kind }),
  };

  const workers = byId("workers_requests");
  const workersRunway: ServiceRunway = {
    id: workers.id,
    label: workers.label,
    used: activity.today,
    ceiling: workers.ceiling,
    unit: workers.unit,
    kind: workers.kind,
    firstParty: workers.firstParty,
    note: workers.note,
    ...estimateRunway({ used: activity.today, ceiling: workers.ceiling, perDayRate: activity.avgPerDay, kind: workers.kind }),
  };

  // Exact figures we don't measure first-party — surfaced honestly, never faked.
  const d1 = byId("d1_rows_written");
  const locked: LockedService[] = [
    { id: d1.id, label: d1.label, ceiling: d1.ceiling, unit: d1.unit, note: d1.note },
    { id: "d1_storage", label: "D1 storage", ceiling: 5 * GIB, unit: "bytes", note: "Exact figure needs Cloudflare Analytics; not yet connected." },
    { id: "durable_objects", label: "Durable Objects", ceiling: 0, unit: "count", note: "Requires the Workers Paid plan — no free-tier quota to track." },
  ];

  return {
    users,
    storage,
    activity,
    runways: [r2Runway, workersRunway],
    locked,
    generatedAtUtc: nowIso,
  };
}
