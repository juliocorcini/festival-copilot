// Admin back-office (R11 / DEC-057). The whole group is gated by the x-admin-token secret; the
// overview aggregates per-festival health for the Festivals screen.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { admin } from "../src/api/admin";
import { getAdminOverview } from "../src/api/adminRepo";
import type { Env } from "../src/env";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = ["0001_init.sql", "0002_festival_map.sql", "0008_festival_with_timetable.sql"]
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
  const perf = (id: string, placeholder: number, start: string | null) =>
    db.prepare(
      `INSERT INTO performance (id, festival_id, source_performance_id, name, stage_id, start_at_utc, is_placeholder, active)
       VALUES (?,?,?,?,?,?,?,1)`
    ).bind(id, "fest-1", id, id, "s-main", start, placeholder).run();
  await perf("p1", 0, "2026-07-18T20:00:00Z");
  await perf("p2", 0, "2026-07-18T21:00:00Z");
  await perf("p3", 1, null); // placeholder (announced, not scheduled)
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
