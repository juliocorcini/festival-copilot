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
import { injectStageFix, listTestMembers, purgeTestData, spawnTestMember } from "../src/api/testConsole";
import { upsertFestivalMap, type FestivalMapInput } from "../src/api/repo";
import type { Env } from "../src/env";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0002_festival_map.sql",
  "0003_app_user_profile.sql",
  "0005_group_shared_plan.sql",
  "0006_presence_ping.sql",
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

describe("live test console (R11.5 / DEC-057d)", () => {
  const NOW = "2026-06-24T20:00:00Z";

  const mapInput: FestivalMapInput = {
    assetSlug: "tml-deschorre",
    baseNightKey: "maps/tml.webp",
    baseDayKey: "maps/tml-day.webp",
    transform: {
      festival: "tml",
      venue: "De Schorre",
      canvas: { width: 1000, height: 1291 },
      bbox: { west: 4.3756, east: 4.3897, south: 51.0849, north: 51.0964 },
      affine: { a: 66789.5, b: 0, c: -292218.5, d: 2.79, e: -106339.4, f: 5433593.1 },
      stages: [{ name: "MAINSTAGE", lng: 4.3864793, lat: 51.0921683, matched: true }],
      source: "OSM",
    },
    revision: 1,
  };

  /** A festival (with map coords) + a real squad owned by a real user. Returns the group id. */
  async function seedSquad(db: D1Database): Promise<string> {
    await seedFestival(db);
    await upsertFestivalMap(db, "fest-1", mapInput, NOW);
    await db
      .prepare(`INSERT INTO app_user (id, firebase_uid, auth_provider, is_anonymous, display_name, created_at_utc, is_test) VALUES (?,?,?,?,?,?,0)`)
      .bind("owner-1", "uid-owner", "google", 0, "Julio", NOW)
      .run();
    await db
      .prepare(`INSERT INTO app_group (id, festival_id, name, created_by_user_id, created_at_utc) VALUES (?,?,?,?,?)`)
      .bind("grp-1", "fest-1", "Squad", "owner-1", NOW)
      .run();
    await db
      .prepare(`INSERT INTO group_member (group_id, user_id, role, share_location, joined_at_utc) VALUES (?,?,?,?,?)`)
      .bind("grp-1", "owner-1", "owner", "while_using", NOW)
      .run();
    return "grp-1";
  }

  it("spawns a synthetic member and drives it to a stage through the real pipeline", async () => {
    const db = await freshDb();
    const groupId = await seedSquad(db);
    const member = await spawnTestMember(db, groupId, NOW);
    expect(member).not.toBeNull();

    const flag = await db.prepare(`SELECT is_test FROM app_user WHERE id = ?`).bind(member!.userId).first<{ is_test: number }>();
    expect(flag?.is_test).toBe(1);

    const res = await injectStageFix(db, member!.userId, groupId, "s-main", NOW);
    expect(res.ok).toBe(true);

    const members = await listTestMembers(db, groupId);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ coarseLabel: "at", stageName: "MAINSTAGE" });
  });

  it("REFUSES to inject a fix for a non-test (real) user", async () => {
    const db = await freshDb();
    const groupId = await seedSquad(db); // owner-1 is a real user
    const res = await injectStageFix(db, "owner-1", groupId, "s-main", NOW);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("not a test user");
    // No presence row was written for the real user.
    const row = await db.prepare(`SELECT COUNT(*) AS c FROM presence WHERE user_id = ?`).bind("owner-1").first<{ c: number }>();
    expect(Number(row?.c)).toBe(0);
  });

  it("purges every test entity and leaves real members untouched", async () => {
    const db = await freshDb();
    const groupId = await seedSquad(db);
    const a = await spawnTestMember(db, groupId, NOW);
    await injectStageFix(db, a!.userId, groupId, "s-main", NOW);
    await spawnTestMember(db, groupId, NOW);

    const purged = await purgeTestData(db);
    expect(purged.users).toBe(2);
    expect(await listTestMembers(db, groupId)).toHaveLength(0);

    // The real owner + their membership survive.
    const owner = await db.prepare(`SELECT COUNT(*) AS c FROM app_user WHERE id = 'owner-1'`).first<{ c: number }>();
    expect(Number(owner?.c)).toBe(1);
    const realMembers = await db.prepare(`SELECT COUNT(*) AS c FROM group_member WHERE group_id = ?`).bind(groupId).first<{ c: number }>();
    expect(Number(realMembers?.c)).toBe(1); // only owner-1 left
    const noPresence = await db.prepare(`SELECT COUNT(*) AS c FROM presence`).first<{ c: number }>();
    expect(Number(noPresence?.c)).toBe(0);
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
