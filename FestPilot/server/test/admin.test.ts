// Admin back-office (R11 / DEC-057). The whole group is gated by the x-admin-token secret; the
// overview aggregates per-festival health for the Festivals screen.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { admin } from "../src/api/admin";
import { getAdminOverview, getLineupDashboard } from "../src/api/adminRepo";
import { getDataSource, readDataSourceInput, upsertDataSource } from "../src/api/dataSource";
import { getMetrics, recordUsage } from "../src/api/metricsRepo";
import { GIB } from "../src/api/runway";
import type { Env } from "../src/env";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0002_festival_map.sql",
  "0008_festival_with_timetable.sql",
  "0010_app_user_identity.sql",
  "0011_media_object.sql",
  "0012_festival_data_source.sql",
  "0013_usage_metrics.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

async function freshDb(): Promise<D1Database> {
  const db = await createSqliteDb(migrations);
  return makeD1(db);
}

/** Seed one festival with 2 stages and 3 active performances (2 scheduled real, 1 placeholder). */
async function seedFestival(db: D1Database): Promise<void> {
  await db.prepare(`INSERT INTO festival (id, name, slug, timezone, created_at_utc, with_timetable) VALUES (?,?,?,?,?,1)`)
    .bind("fest-1", "Tomorrowland", "tml", "Europe/Brussels", "2026-01-01T00:00:00Z").run();
  await db.prepare(`INSERT INTO lineup_revision (festival_id, revision, updated_at_utc) VALUES (?,?,?)`)
    .bind("fest-1", 7, "2026-06-24T00:00:00Z").run();
  await db.prepare(`INSERT INTO stage (id, festival_id, source_stage_id, name, sort_order) VALUES (?,?,?,?,?)`)
    .bind("s-main", "fest-1", "main", "MAINSTAGE", 0).run();
  await db.prepare(`INSERT INTO stage (id, festival_id, source_stage_id, name, sort_order) VALUES (?,?,?,?,?)`)
    .bind("s-core", "fest-1", "core", "CORE", 1).run();
  const perf = (id: string, placeholder: number, start: string | null, day: string | null) =>
    db.prepare(
      `INSERT INTO performance (id, festival_id, source_performance_id, name, stage_id, day, start_at_utc, is_placeholder, active)
       VALUES (?,?,?,?,?,?,?,?,1)`
    ).bind(id, "fest-1", id, id, "s-main", day, start, placeholder).run();
  await perf("p1", 0, "2026-07-18T20:00:00Z", "FRIDAY");
  await perf("p2", 0, "2026-07-18T21:00:00Z", "FRIDAY");
  await perf("p3", 1, null, null); // placeholder (announced, not scheduled)
  await db
    .prepare(
      `INSERT INTO lineup_source (id, festival_id, event, uuid, source_page_url, first_seen_at_utc, last_seen_at_utc, active)
       VALUES (?,?,?,?,?,?,?,1)`
    )
    .bind("src-1", "fest-1", "TL26BE", "uuid-123", "https://belgium.tomorrowland.com", "2026-06-01T00:00:00Z", "2026-06-24T08:00:00Z")
    .run();
}

const envWith = (db: D1Database, token?: string): Env =>
  ({ DB: db, ADMIN_TOKEN: token } as unknown as Env);

describe("getAdminOverview (R11.1a)", () => {
  it("aggregates per-festival health + global KPIs without N+1", async () => {
    const db = await freshDb();
    await seedFestival(db);
    const overview = await getAdminOverview(db);

    expect(overview.totals).toEqual({ festivals: 1, stages: 2, performances: 2, scheduled: 2 });
    expect(overview.festivals).toHaveLength(1);
    const f = overview.festivals[0];
    expect(f).toMatchObject({
      id: "fest-1",
      name: "Tomorrowland",
      slug: "tml",
      revision: 7,
      withTimetable: true,
      stageCount: 2,
      performanceCount: 2, // placeholders excluded
      scheduledCount: 2,
      hasMap: false,
    });
  });

  it("reports an empty overview when there are no festivals", async () => {
    const db = await freshDb();
    const overview = await getAdminOverview(db);
    expect(overview.totals).toEqual({ festivals: 0, stages: 0, performances: 0, scheduled: 0 });
    expect(overview.festivals).toEqual([]);
  });
});

describe("getLineupDashboard (R11.1b)", () => {
  it("surfaces the documented source, dynamic days and per-stage health", async () => {
    const db = await freshDb();
    await seedFestival(db);
    const dash = await getLineupDashboard(db, "fest-1");
    expect(dash).not.toBeNull();
    expect(dash!.source).toMatchObject({ event: "TL26BE", uuid: "uuid-123", sourcePageUrl: "https://belgium.tomorrowland.com" });
    expect(dash!.days).toEqual(["FRIDAY"]);
    expect(dash!.totals).toEqual({ sets: 2, scheduled: 2, stages: 2 });
    expect(dash!.needsEndTime).toBe(2); // both real sets lack an end time
    const main = dash!.stages.find((s) => s.id === "s-main")!;
    expect(main).toMatchObject({ total: 2, scheduled: 2, countsByDay: { FRIDAY: 2 }, firstStartUtc: "2026-07-18T20:00:00Z", lastStartUtc: "2026-07-18T21:00:00Z" });
    const core = dash!.stages.find((s) => s.id === "s-core")!;
    expect(core).toMatchObject({ total: 0, countsByDay: {} });
  });

  it("returns null for an unknown festival", async () => {
    const db = await freshDb();
    expect(await getLineupDashboard(db, "nope")).toBeNull();
  });
});

describe("data-source registry (R11.2 / DEC-057a)", () => {
  it("seeds an honest default from the operational source when no record is saved", async () => {
    const db = await freshDb();
    await seedFestival(db);
    const dto = await getDataSource(db, "fest-1");
    expect(dto.updatedAtUtc).toBeNull(); // never saved yet
    expect(dto.origin).toBe("official_page");
    expect(dto).toMatchObject({ event: "TL26BE", uuid: "uuid-123", pageUrl: "https://belgium.tomorrowland.com" });
    expect(dto.operational).toMatchObject({ event: "TL26BE", uuid: "uuid-123" });
  });

  it("persists an operator record and keeps the operational reference", async () => {
    const db = await freshDb();
    await seedFestival(db);
    await upsertDataSource(
      db,
      "fest-1",
      { origin: "manual", pageUrl: null, event: null, uuid: null, captureMethod: "Typed by hand", notes: "no clean source", aiReaderEnabled: false },
      "2026-06-24T12:00:00Z"
    );
    const dto = await getDataSource(db, "fest-1");
    expect(dto.origin).toBe("manual");
    expect(dto.captureMethod).toBe("Typed by hand");
    expect(dto.updatedAtUtc).toBe("2026-06-24T12:00:00Z");
    // The operational source is still surfaced read-only for cross-checking.
    expect(dto.operational).toMatchObject({ event: "TL26BE" });
  });

  it("validates + trims the input, defaulting an unknown origin to manual", () => {
    const input = readDataSourceInput({ origin: "garbage", event: "  TL26BE  ", aiReaderEnabled: true });
    expect(input.origin).toBe("manual");
    expect(input.event).toBe("TL26BE");
    expect(input.aiReaderEnabled).toBe(true);
    expect(input.notes).toBeNull();
  });
});

describe("usage metrics + runway (R11.4 / DEC-057c)", () => {
  const NOW = "2026-06-24T12:00:00Z";

  async function seedUser(
    db: D1Database,
    u: { id: string; name?: string | null; email?: string | null; country?: string | null; anon?: boolean; isTest?: boolean; lastSeen?: string; created?: string }
  ): Promise<void> {
    await db
      .prepare(
        `INSERT INTO app_user (id, firebase_uid, auth_provider, is_anonymous, display_name, email, country, last_seen_utc, created_at_utc, is_test)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      )
      .bind(
        u.id,
        `uid-${u.id}`,
        u.anon ? "anonymous" : "google",
        u.anon ? 1 : 0,
        u.name ?? null,
        u.email ?? null,
        u.country ?? null,
        u.lastSeen ?? "2026-06-23T00:00:00Z",
        u.created ?? "2026-06-22T00:00:00Z",
        u.isTest ? 1 : 0
      )
      .run();
  }

  async function seedMedia(db: D1Database, key: string, bytes: number, created: string): Promise<void> {
    await db
      .prepare(`INSERT INTO media_object (key, kind, owner_user_id, byte_size, content_type, created_at_utc) VALUES (?,?,?,?,?,?)`)
      .bind(key, "avatar", "u1", bytes, "image/webp", created)
      .run();
  }

  it("aggregates only REAL users, excluding is_test synthetic ones", async () => {
    const db = await freshDb();
    await seedUser(db, { id: "u1", name: "Julio", email: "j@x.io", country: "BE", lastSeen: NOW, created: "2026-06-23T00:00:00Z" });
    await seedUser(db, { id: "u2", anon: true, country: "NL" });
    await seedUser(db, { id: "t1", name: "Bot", isTest: true, country: "BE" }); // must be excluded

    const m = await getMetrics(db, NOW);
    expect(m.users.total).toBe(2);
    expect(m.users.testUsers).toBe(1);
    expect(m.users.withEmail).toBe(1);
    expect(m.users.anonymous).toBe(1);
    expect(m.users.named).toBe(1);
    expect(m.users.activeLast7d).toBe(2);
    expect(m.users.newLast7d).toBe(2);
    expect(m.users.byCountry).toEqual([
      { country: "BE", count: 1 },
      { country: "NL", count: 1 },
    ]); // test BE user not counted
  });

  it("reports real R2 storage from the media ledger and a growth-based runway", async () => {
    const db = await freshDb();
    await seedMedia(db, "avatars/a.webp", 2 * GIB, "2026-06-20T00:00:00Z"); // within the 7d window
    await seedMedia(db, "meetings/m.webp", 1 * GIB, "2026-06-21T00:00:00Z");

    const m = await getMetrics(db, NOW);
    expect(m.storage.objectCount).toBe(2);
    expect(m.storage.totalBytes).toBe(3 * GIB);
    const r2 = m.runways.find((r) => r.id === "r2_storage")!;
    expect(r2.used).toBe(3 * GIB);
    expect(r2.ceiling).toBe(10 * GIB);
    expect(r2.firstParty).toBe(true);
    expect(r2.daysLeft).not.toBeNull(); // 3 GiB grew in 7 days → a finite runway
    expect(r2.kind).toBe("cumulative");
  });

  it("surfaces locked services honestly instead of faking platform numbers", async () => {
    const db = await freshDb();
    const m = await getMetrics(db, NOW);
    const ids = m.locked.map((l) => l.id);
    expect(ids).toContain("d1_rows_written");
    expect(ids).toContain("durable_objects");
    // The first-party Workers card is present but flagged as a lower bound.
    expect(m.runways.find((r) => r.id === "workers_requests")!.firstParty).toBe(false);
  });

  it("recordUsage increments one row per kind per UTC day", async () => {
    const db = await freshDb();
    await recordUsage(db, "me_touch", NOW);
    await recordUsage(db, "me_touch", NOW);
    await recordUsage(db, "me_touch", "2026-06-24T23:59:00Z"); // same UTC day
    const row = await db.prepare(`SELECT count FROM usage_counter WHERE day = ? AND kind = ?`).bind("2026-06-24", "me_touch").first<{ count: number }>();
    expect(Number(row?.count)).toBe(3);

    const m = await getMetrics(db, NOW);
    expect(m.activity.today).toBe(3);
    expect(m.activity.kind).toBe("me_touch");
  });
});

describe("admin guard (R11.0 / x-admin-token)", () => {
  it("rejects a request with no token", async () => {
    const res = await admin.request("/ping", {}, envWith(await freshDb(), "secret"));
    expect(res.status).toBe(401);
  });

  it("rejects a request with the wrong token", async () => {
    const res = await admin.request("/ping", { headers: { "x-admin-token": "nope" } }, envWith(await freshDb(), "secret"));
    expect(res.status).toBe(401);
  });

  it("rejects every request when ADMIN_TOKEN is not configured (fail closed)", async () => {
    const res = await admin.request("/ping", { headers: { "x-admin-token": "anything" } }, envWith(await freshDb(), undefined));
    expect(res.status).toBe(401);
  });

  it("accepts a request with the correct token", async () => {
    const res = await admin.request("/ping", { headers: { "x-admin-token": "secret" } }, envWith(await freshDb(), "secret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("serves the overview to an authorized caller", async () => {
    const db = await freshDb();
    await seedFestival(db);
    const res = await admin.request("/overview", { headers: { "x-admin-token": "secret" } }, envWith(db, "secret"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totals: { festivals: number }; festivals: unknown[] };
    expect(body.totals.festivals).toBe(1);
    expect(body.festivals).toHaveLength(1);
  });
});
