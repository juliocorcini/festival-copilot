import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";

import { parseAuthIdentity } from "../src/auth";
import { ulid } from "../src/db/ids";
import { ensureUser } from "../src/api/users";
import { createGroup, joinByToken } from "../src/api/groups";
import { createMeetingPoint, getMeetingPoint, listMeetingPoints } from "../src/api/meetingPoints";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0002_festival_map.sql",
  "0003_app_user_profile.sql",
  "0004_app_group_emoji.sql",
  "0005_group_shared_plan.sql",
  "0006_presence_ping.sql",
  "0007_meeting_point_meet_at.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const FESTIVAL_ID = "fest_tl26";

// MAIN, and CORE ~400 m east (same little geography as the presence test).
const MAIN = { id: "main", name: "MAINSTAGE", lat: 51.0, lng: 4.0 };
const CORE = { id: "core", name: "CORE", lat: 51.0, lng: 4.00571 };

async function freshDb(): Promise<D1Database> {
  const db: Database = await createSqliteDb(migrations);
  const d1 = makeD1(db);
  await d1
    .prepare(`INSERT INTO festival (id, name, slug, timezone, created_at_utc) VALUES (?,?,?,?,?)`)
    .bind(FESTIVAL_ID, "Tomorrowland 2026", "tl-2026", "Europe/Brussels", "2026-01-01T00:00:00Z")
    .run();
  for (const s of [MAIN, CORE]) {
    await d1
      .prepare(`INSERT INTO stage (id, festival_id, source_stage_id, name, sort_order) VALUES (?,?,?,?,?)`)
      .bind(s.id, FESTIVAL_ID, s.id, s.name, 0)
      .run();
  }
  const transform = {
    festival: "tl",
    venue: "de schorre",
    canvas: { width: 1000, height: 1000 },
    bbox: { west: 3.9, east: 4.1, south: 50.9, north: 51.1 },
    affine: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    stages: [
      { name: MAIN.name, lng: MAIN.lng, lat: MAIN.lat, matched: true },
      { name: CORE.name, lng: CORE.lng, lat: CORE.lat, matched: true },
    ],
    source: "test",
  };
  await d1
    .prepare(
      `INSERT INTO festival_map (festival_id, asset_slug, base_night_key, base_day_key, transform_json, revision, updated_at_utc)
       VALUES (?,?,?,?,?,?,?)`
    )
    .bind(FESTIVAL_ID, "tl-2026", "n.webp", "d.webp", JSON.stringify(transform), 1, "2026-01-01T00:00:00Z")
    .run();
  return d1;
}

async function makeUser(d1: D1Database, name: string) {
  const identity = parseAuthIdentity(`Bearer anon.${ulid()}`)!;
  return ensureUser(d1, identity, "2026-06-23T10:00:00Z", { displayName: name });
}

const NOW = "2026-07-18T20:30:00Z";

describe("meeting points (UC-27 — exact opt-in spot, coarse landmark label)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("creates a 'come to me' point: exact coords stored, creator going, labelled 'at MAINSTAGE'", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: "🔥", festivalId: FESTIVAL_ID }, "t");

    const point = await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g.id,
      owner.id,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, title: "By the mainstage rail", note: "left of the sound desk", meetAtUtc: null },
      NOW
    );

    expect(point.title).toBe("By the mainstage rail");
    expect(point.landmarkLabel).toBe("at MAINSTAGE");
    expect(point.isMine).toBe(true);
    // The exact coordinate IS carried (the creator's explicit share, DEC-046).
    expect(point.lat).toBeCloseTo(MAIN.lat, 6);
    expect(point.lng).toBeCloseTo(MAIN.lng, 6);
    // The creator is auto "going"; the tally reflects it.
    expect(point.myStatus).toBe("going");
    expect(point.goingCount).toBe(1);
    expect(point.hereCount).toBe(0);
    // A meet-now point auto-closes a 30-min grace window after now.
    expect(Date.parse(point.expiresAtUtc) - Date.parse(NOW)).toBe(30 * 60_000);

    const list = await listMeetingPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW);
    expect(list.map((p) => p.id)).toContain(point.id);
  });

  it("labels a spot halfway between two stages as 'between MAINSTAGE & CORE'", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    const midLng = (MAIN.lng + CORE.lng) / 2;
    const point = await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g.id,
      owner.id,
      { lat: MAIN.lat, lng: midLng, accuracyMeters: 12, title: "Halfway", note: null, meetAtUtc: null },
      NOW
    );
    expect(point.landmarkLabel.startsWith("between ")).toBe(true);
    expect(point.landmarkLabel).toContain("MAINSTAGE");
    expect(point.landmarkLabel).toContain("CORE");
  });

  it("derives expiry from the FUTURE meet time + 30-min grace (not from now)", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    const meetAt = "2026-07-18T21:00:00Z"; // 30 min in the future
    const point = await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g.id,
      owner.id,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: null, title: "later", note: null, meetAtUtc: meetAt },
      NOW
    );
    // Closes 30 min after the MEET time → 60 min after now.
    expect(Date.parse(point.expiresAtUtc) - Date.parse(meetAt)).toBe(30 * 60_000);
    expect(Date.parse(point.expiresAtUtc) - Date.parse(NOW)).toBe(60 * 60_000);
  });

  it("clamps an out-of-range grace window into a sane range", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    const point = await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g.id,
      owner.id,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: null, title: "x", note: null, meetAtUtc: null, graceMinutes: 99999 },
      NOW
    );
    expect(Date.parse(point.expiresAtUtc) - Date.parse(NOW)).toBe(240 * 60_000); // clamped to MAX
  });

  it("drops expired points from the active list (auto-fade by expiry window)", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g.id,
      owner.id,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: null, title: "short", note: null, meetAtUtc: null, graceMinutes: 10 },
      NOW
    );
    expect((await listMeetingPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW)).length).toBe(1);
    const after = "2026-07-18T20:41:00Z"; // 11 min later — past the 10-min grace window
    expect((await listMeetingPoints(d1, FESTIVAL_ID, g.id, owner.id, after)).length).toBe(0);
  });

  it("a squad-mate sees the point but as not theirs (isMine=false)", async () => {
    const owner = await makeUser(d1, "Julio");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");
    const point = await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g.id,
      owner.id,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, title: "Owner's spot", note: null, meetAtUtc: null },
      NOW
    );
    const seenByMara = await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, mara.id);
    expect(seenByMara).not.toBeNull();
    expect(seenByMara!.isMine).toBe(false);
    expect(seenByMara!.myStatus).toBeNull();
    expect(seenByMara!.goingCount).toBe(1); // the owner is going
  });

  it("does not leak another group's points", async () => {
    const owner = await makeUser(d1, "Julio");
    const g1 = await createGroup(d1, owner.id, { name: "A", emoji: null, festivalId: FESTIVAL_ID }, "t");
    const g2 = await createGroup(d1, owner.id, { name: "B", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g1.id,
      owner.id,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, title: "g1 spot", note: null, meetAtUtc: null },
      NOW
    );
    expect((await listMeetingPoints(d1, FESTIVAL_ID, g2.id, owner.id, NOW)).length).toBe(0);
  });
});
