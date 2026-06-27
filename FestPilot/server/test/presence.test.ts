import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";

import { parseAuthIdentity } from "../src/auth";
import { ulid } from "../src/db/ids";
import { ensureUser } from "../src/api/users";
import { createGroup, joinByToken } from "../src/api/groups";
import {
  getGroupPresence,
  purgeExpiredPresence,
  recordFix,
  setGroupShareMode,
  setSharingForAllGroups,
} from "../src/api/presence";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0002_festival_map.sql",
  "0003_app_user_profile.sql",
  "0004_app_group_emoji.sql",
  "0005_group_shared_plan.sql",
  "0010_app_user_identity.sql",
  "0013_usage_metrics.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const FESTIVAL_ID = "fest_tl26";

// Same little geography as the domain test: MAIN, and CORE ~400 m east.
const MAIN = { id: "main", name: "MAINSTAGE", lat: 51.0, lng: 4.0 };
const CORE = { id: "core", name: "CORE", lat: 51.0, lng: 4.00571 };

/** Seed a festival with two georeferenced stages (via the map transform) + a live act on MAIN. */
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
  // A set currently playing on MAINSTAGE so current-artist auto-detection has something to find.
  await d1
    .prepare(`INSERT INTO artist (id, source_artist_id, name) VALUES (?,?,?)`)
    .bind("art_mg", "mg", "Martin Garrix")
    .run();
  await d1
    .prepare(
      `INSERT INTO performance (id, festival_id, stage_id, source_performance_id, name, day, start_at_utc, end_at_utc, active)
       VALUES (?,?,?,?,?,?,?,?,1)`
    )
    .bind("perf_mg", FESTIVAL_ID, MAIN.id, "mg", "Martin Garrix", "SATURDAY", "2026-07-18T20:00:00Z", "2026-07-18T21:00:00Z")
    .run();
  await d1
    .prepare(`INSERT INTO performance_artist (performance_id, artist_id, sort_order) VALUES (?,?,0)`)
    .bind("perf_mg", "art_mg")
    .run();
  return d1;
}

async function makeUser(d1: D1Database, name: string) {
  const identity = parseAuthIdentity(`Bearer anon.${ulid()}`)!;
  return ensureUser(d1, identity, "2026-06-23T10:00:00Z", { displayName: name });
}

const NOW = "2026-07-18T20:30:00Z"; // mid-set

describe("presence pipeline (UC-21/22/24 — coarse + honest)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("a raw fix becomes an 'at MAINSTAGE / watching Martin Garrix' coarse reading", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: "🔥", festivalId: FESTIVAL_ID }, "t");
    await setGroupShareMode(d1, g.id, owner.id, "stage", 60, NOW);

    const affected = await recordFix(d1, owner.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);
    expect(affected).toEqual([g.id]);

    const roster = await getGroupPresence(d1, g.id, owner.id, NOW);
    const me = roster.members.find((m) => m.isYou)!;
    expect(me.presence?.coarseLabel).toBe("at");
    expect(me.presence?.stageName).toBe("MAINSTAGE");
    expect(me.presence?.currentArtistName).toBe("Martin Garrix");
    expect(me.presence?.confidence).toBe("high");
    expect(me.presence?.stale).toBe(false);
    expect(roster.liveCount).toBe(1);
  });

  it("NEVER returns raw coordinates to clients (DEC-015 privacy contract)", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await setGroupShareMode(d1, g.id, owner.id, "stage", 60, NOW);
    await recordFix(d1, owner.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);

    const roster = await getGroupPresence(d1, g.id, owner.id, NOW);
    const serialized = JSON.stringify(roster);
    // No coordinate KEYS anywhere in the client payload...
    expect(serialized).not.toContain('"lat"');
    expect(serialized).not.toContain('"lng"');
    // ...and the unique CORE longitude (a value only a coordinate leak could produce) never appears.
    expect(serialized).not.toContain("4.00571");
    for (const m of roster.members) {
      if (m.presence) {
        expect(Object.keys(m.presence)).not.toContain("lat");
        expect(Object.keys(m.presence)).not.toContain("lng");
      }
    }
    // But the raw fix IS persisted server-side (so coarsening + meeting-points can use it later).
    const raw = await d1
      .prepare(`SELECT lat, lng FROM presence WHERE group_id = ? AND user_id = ?`)
      .bind(g.id, owner.id)
      .first<{ lat: number; lng: number }>();
    expect(raw?.lat).toBeCloseTo(MAIN.lat, 3);
  });

  it("ghost mode hides the member and removes their stored fix", async () => {
    const owner = await makeUser(d1, "Owner");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");
    await setGroupShareMode(d1, g.id, mara.id, "stage", 60, NOW);
    await recordFix(d1, mara.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);

    // Mara goes ghost → her presence is wiped and she shows nothing to the squad.
    await setGroupShareMode(d1, g.id, mara.id, "ghost", 60, NOW);
    const roster = await getGroupPresence(d1, g.id, owner.id, NOW);
    const maraEntry = roster.members.find((m) => m.userId === mara.id)!;
    expect(maraEntry.shareMode).toBe("ghost");
    expect(maraEntry.presence).toBeNull();

    // A fresh fix while ghost must not create a presence row.
    await recordFix(d1, mara.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);
    const after = await getGroupPresence(d1, g.id, owner.id, NOW);
    expect(after.members.find((m) => m.userId === mara.id)!.presence).toBeNull();
  });

  it("precise mode is live with a countdown and hard-expires server-side", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await setGroupShareMode(d1, g.id, owner.id, "precise", 60, NOW);
    await recordFix(d1, owner.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);

    const roster = await getGroupPresence(d1, g.id, owner.id, NOW);
    const me = roster.members.find((m) => m.isYou)!;
    expect(me.shareMode).toBe("precise");
    expect(me.live).toBe(true);
    expect(me.liveSecondsLeft).toBeGreaterThan(59 * 60);
    expect(roster.me.live).toBe(true);

    // 61 minutes later the precise window has lapsed: cron downgrades it to coarse, no longer "live".
    const later = "2026-07-18T21:31:00Z";
    await purgeExpiredPresence(d1, later);
    const after = await getGroupPresence(d1, g.id, owner.id, later);
    const meAfter = after.members.find((m) => m.isYou)!;
    expect(meAfter.shareMode).toBe("stage");
    expect(meAfter.live).toBe(false);
  });

  it("precise+live exposes the exact pin to the squad (DEC-099) — coarse stays coordinate-free", async () => {
    const owner = await makeUser(d1, "Julio");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");
    // Owner shares precise (exact pin); Mara shares only coarse (stage).
    await setGroupShareMode(d1, g.id, owner.id, "precise", 60, NOW);
    await setGroupShareMode(d1, g.id, mara.id, "stage", 60, NOW);
    await recordFix(d1, owner.id, { lat: CORE.lat, lng: CORE.lng, accuracyMeters: 12, source: "gps" }, NOW);
    await recordFix(d1, mara.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);

    const roster = await getGroupPresence(d1, g.id, mara.id, NOW);
    // Exactly one precise pin — the owner — carrying the real coordinate, accuracy + TTL.
    expect(roster.precise).toHaveLength(1);
    const pin = roster.precise[0]!;
    expect(pin.userId).toBe(owner.id);
    expect(pin.lat).toBeCloseTo(CORE.lat, 5);
    expect(pin.lng).toBeCloseTo(CORE.lng, 5);
    expect(pin.accuracyMeters).toBe(12);
    expect(Date.parse(pin.expiresAtUtc)).toBeGreaterThan(Date.parse(NOW));
    expect(pin.ageSeconds).toBe(0);

    // The coarse member rows still carry NO coordinate (only the precise channel does).
    for (const m of roster.members) {
      if (m.presence) {
        expect(Object.keys(m.presence)).not.toContain("lat");
        expect(Object.keys(m.presence)).not.toContain("lng");
      }
    }
    // Mara (coarse only) never appears in the precise channel.
    expect(roster.precise.some((p) => p.userId === mara.id)).toBe(false);
  });

  it("a live precise window with a STALE fix exposes no exact pin (falls back to coarse)", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await setGroupShareMode(d1, g.id, owner.id, "precise", 60, NOW);
    await recordFix(d1, owner.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);

    // 20 min on: the precise WINDOW is still open (live), but the GPS fix (15-min) is stale — a 20-min
    // old "exact" dot would be a lie, so the precise channel is empty while the member stays live.
    const stale = "2026-07-18T20:50:00Z";
    const roster = await getGroupPresence(d1, g.id, owner.id, stale);
    expect(roster.members.find((m) => m.isYou)!.live).toBe(true);
    expect(roster.precise).toHaveLength(0);
  });

  it("a stale GPS fix is flagged (not counted live) and purged by the cron", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await setGroupShareMode(d1, g.id, owner.id, "stage", 60, NOW);
    await recordFix(d1, owner.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);

    // 20 min later a GPS fix (15-min window) is stale: still shown, but not "live".
    const stale = "2026-07-18T20:50:00Z";
    const roster = await getGroupPresence(d1, g.id, owner.id, stale);
    const me = roster.members.find((m) => m.isYou)!;
    expect(me.presence?.stale).toBe(true);
    expect(roster.liveCount).toBe(0);

    // The cron then purges the expired row entirely.
    const purged = await purgeExpiredPresence(d1, stale);
    expect(purged.purged).toBe(1);
    const after = await getGroupPresence(d1, g.id, owner.id, stale);
    expect(after.members.find((m) => m.isYou)!.presence).toBeNull();
  });

  it("pause-all hides the member across every squad at once", async () => {
    const owner = await makeUser(d1, "Julio");
    const g1 = await createGroup(d1, owner.id, { name: "A", emoji: null, festivalId: FESTIVAL_ID }, "t");
    const g2 = await createGroup(d1, owner.id, { name: "B", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await setGroupShareMode(d1, g1.id, owner.id, "stage", 60, NOW);
    await setGroupShareMode(d1, g2.id, owner.id, "stage", 60, NOW);
    await recordFix(d1, owner.id, { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, source: "gps" }, NOW);

    await setSharingForAllGroups(d1, owner.id, "ghost");
    for (const g of [g1, g2]) {
      const roster = await getGroupPresence(d1, g.id, owner.id, NOW);
      expect(roster.members.find((m) => m.isYou)!.presence).toBeNull();
      expect(roster.members.find((m) => m.isYou)!.shareMode).toBe("ghost");
    }
  });
});
