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
  createMeetingPoint,
  endMeetingPoint,
  getMeetingPoint,
  listActiveSafetyPoints,
  listMeetingPoints,
  purgeExpiredMeetingPoints,
  setMyMeetingStatus,
} from "../src/api/meetingPoints";
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

/** Drop a raw presence fix directly (server-only lat/lng) so we can exercise meeting-point ETAs. */
async function putPresence(
  d1: D1Database,
  groupId: string,
  userId: string,
  lat: number,
  lng: number,
  nowIso: string,
  freshMinutes = 15
): Promise<void> {
  await d1
    .prepare(
      `INSERT INTO presence (id, group_id, user_id, coarse_label, lat, lng, source, updated_at_utc, expires_at_utc)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .bind(ulid(), groupId, userId, "at", lat, lng, "gps", nowIso, new Date(Date.parse(nowIso) + freshMinutes * 60_000).toISOString())
    .run();
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
    const seenByMara = await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, mara.id, NOW);
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

describe("meeting points — lifecycle, status loop, ETA & purge (Gate 6.2, UC-28)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  async function squadOf3() {
    const owner = await makeUser(d1, "Julio");
    const mara = await makeUser(d1, "Mara");
    const theo = await makeUser(d1, "Theo");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");
    await joinByToken(d1, theo.id, g.inviteToken!, "t2");
    return { owner, mara, theo, g };
  }

  async function dropAtMain(groupId: string, userId: string) {
    return createMeetingPoint(
      d1,
      FESTIVAL_ID,
      groupId,
      userId,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, title: "Cactus Bar", note: null, meetAtUtc: null },
      NOW
    );
  }

  it("a fresh point with only the creator going is 'active'; non-responders show as 'no_response'", async () => {
    const { owner, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    const detail = (await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, NOW))!;
    expect(detail.lifecycle).toBe("active");
    expect(detail.everyoneHere).toBe(false);
    // The detail roster carries the WHOLE squad (3), not just responders.
    expect(detail.members.length).toBe(3);
    const byName = new Map(detail.members.map((m) => [m.displayName, m.status]));
    expect(byName.get("Julio")).toBe("going");
    expect(byName.get("Mara")).toBe("no_response");
    expect(byName.get("Theo")).toBe("no_response");
    expect(detail.goingCount).toBe(1);
    expect(detail.hereCount).toBe(0);
  });

  it("status loop: going → on_the_way; everyone arrives → everyone_here", async () => {
    const { owner, mara, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);

    // Mara marks "arrived": owner(going) + mara(here) = 2 committed but not all here.
    let detail = (await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, mara.id, "arrived", NOW))!;
    expect(detail.hereCount).toBe(1);
    expect(detail.goingCount).toBe(1);
    expect(detail.lifecycle).toBe("on_the_way");

    // The creator also arrives → both committed members are here → reunion.
    detail = (await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, owner.id, "arrived", NOW))!;
    expect(detail.hereCount).toBe(2);
    expect(detail.lifecycle).toBe("everyone_here");
    expect(detail.everyoneHere).toBe(true);
    // Theo never responded and doesn't block the reunion.
    expect(detail.members.find((m) => m.displayName === "Theo")!.status).toBe("no_response");
  });

  it("'not_going' keeps the point from a false reunion and carries no ETA", async () => {
    const { owner, mara, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, owner.id, "arrived", NOW);
    const detail = (await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, mara.id, "not_going", NOW))!;
    // Only the creator is committed (1) → not a reunion.
    expect(detail.lifecycle).toBe("on_the_way");
    const maraRow = detail.members.find((m) => m.displayName === "Mara")!;
    expect(maraRow.status).toBe("not_going");
    expect(maraRow.etaMinutes).toBeNull();
  });

  it("derives a live walk ETA + distance for members heading over who share a fresh fix", async () => {
    const { owner, mara, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, mara.id, "going", NOW);
    // Mara is at CORE (~400 m east of MAIN, where the point is).
    await putPresence(d1, g.id, mara.id, CORE.lat, CORE.lng, NOW);
    const detail = (await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, NOW))!;
    const maraRow = detail.members.find((m) => m.displayName === "Mara")!;
    expect(maraRow.distanceMeters).toBeGreaterThan(350);
    expect(maraRow.distanceMeters).toBeLessThan(450);
    expect(maraRow.etaMinutes).toBe(8); // ~400 m × 1.3 / 67 ≈ 8 min
  });

  it("an arrived member shows no ETA (they're already there)", async () => {
    const { owner, mara, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, mara.id, "arrived", NOW);
    await putPresence(d1, g.id, mara.id, CORE.lat, CORE.lng, NOW);
    const detail = (await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, NOW))!;
    const maraRow = detail.members.find((m) => m.displayName === "Mara")!;
    expect(maraRow.etaMinutes).toBeNull();
    expect(maraRow.distanceMeters).toBeNull();
  });

  it("a stale fix yields no ETA (we don't pretend to know where they are)", async () => {
    const { owner, mara, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, mara.id, "going", NOW);
    // Fix that already expired 1 min before NOW.
    await putPresence(d1, g.id, mara.id, CORE.lat, CORE.lng, "2026-07-18T20:14:00Z", 15);
    const detail = (await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, NOW))!;
    expect(detail.members.find((m) => m.displayName === "Mara")!.etaMinutes).toBeNull();
  });

  it("flags creator drift when the creator's fresh fix is far from the spot", async () => {
    const { owner, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    // No fix yet → no prompt.
    expect((await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, NOW))!.creatorDrifted).toBe(false);
    // Creator wandered ~400 m off to CORE.
    await putPresence(d1, g.id, owner.id, CORE.lat, CORE.lng, NOW);
    expect((await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, NOW))!.creatorDrifted).toBe(true);
  });

  it("setting a status on a cancelled point is refused", async () => {
    const { owner, mara, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    await endMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, "cancel", NOW);
    const blocked = await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, point.id, mara.id, "going", NOW);
    expect(blocked).toBeNull();
  });

  it("cancel → lifecycle 'cancelled' and dropped from the active list", async () => {
    const { owner, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    const ended = (await endMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, "cancel", NOW))!;
    expect(ended.lifecycle).toBe("cancelled");
    expect((await listMeetingPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW)).length).toBe(0);
  });

  it("close → lifecycle 'expired' (archived) and dropped from the active list", async () => {
    const { owner, g } = await squadOf3();
    const point = await dropAtMain(g.id, owner.id);
    const ended = (await endMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, "close", NOW))!;
    expect(ended.lifecycle).toBe("expired");
    expect((await listMeetingPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW)).length).toBe(0);
  });

  it("cron purge: auto-fades an expired point to archived, then purges it after the grace window", async () => {
    const { owner, g } = await squadOf3();
    const point = await createMeetingPoint(
      d1,
      FESTIVAL_ID,
      g.id,
      owner.id,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: null, title: "short", note: null, meetAtUtc: null, graceMinutes: 10 },
      NOW
    );

    // 15 min later: past the 10-min grace → archived (faded), but still within the keep window.
    const faded = await purgeExpiredMeetingPoints(d1, "2026-07-18T20:45:00Z");
    expect(faded.archived).toBe(1);
    expect(faded.purged).toBe(0);
    expect((await listMeetingPoints(d1, FESTIVAL_ID, g.id, owner.id, "2026-07-18T20:45:00Z")).length).toBe(0);
    // The "who went" record is still readable right after fading.
    expect(await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, "2026-07-18T20:45:00Z")).not.toBeNull();

    // 7 h later: past the keep window → purged (point + member rows gone).
    const purged = await purgeExpiredMeetingPoints(d1, "2026-07-19T03:30:00Z");
    expect(purged.purged).toBe(1);
    expect(await getMeetingPoint(d1, FESTIVAL_ID, g.id, point.id, owner.id, "2026-07-19T03:30:00Z")).toBeNull();
  });
});

describe("safety / 'I'm lost' broadcast (Gate 6.3, UC-28, DEC-022)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  async function squadOf2() {
    const owner = await makeUser(d1, "Julio");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");
    return { owner, mara, g };
  }

  async function dropSafety(groupId: string, userId: string) {
    return createMeetingPoint(
      d1,
      FESTIVAL_ID,
      groupId,
      userId,
      { lat: MAIN.lat, lng: MAIN.lng, accuracyMeters: 8, title: "Julio needs help", note: null, meetAtUtc: null, isSafety: true },
      NOW
    );
  }

  it("a safety broadcast is flagged is_safety, carries the exact spot, and lives for hours", async () => {
    const { owner, g } = await squadOf2();
    const sos = await dropSafety(g.id, owner.id);
    expect(sos.isSafety).toBe(true);
    expect(sos.lat).toBeCloseTo(MAIN.lat, 6);
    expect(sos.lng).toBeCloseTo(MAIN.lng, 6);
    // It ends on "I'm okay", not a 30-min timer — the default safety grace is 4 h.
    expect(Date.parse(sos.expiresAtUtc) - Date.parse(NOW)).toBe(240 * 60_000);
  });

  it("lives in its own lane: excluded from the meeting list, present in the safety list", async () => {
    const { owner, g } = await squadOf2();
    const sos = await dropSafety(g.id, owner.id);
    // Not mixed into the regular "come to me" list…
    expect((await listMeetingPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW)).map((p) => p.id)).not.toContain(sos.id);
    // …but visible in the safety lane, with isMine for the lost member.
    const lane = await listActiveSafetyPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW);
    expect(lane.map((p) => p.id)).toEqual([sos.id]);
    expect(lane[0].isMine).toBe(true);
    expect(lane[0].isSafety).toBe(true);
  });

  it("the safety lane carries the converging squad with live ETAs to the lost member", async () => {
    const { owner, mara, g } = await squadOf2();
    const sos = await dropSafety(g.id, owner.id);
    // Mara is heading over from CORE (~400 m) and sharing a fresh fix.
    await setMyMeetingStatus(d1, FESTIVAL_ID, g.id, sos.id, mara.id, "going", NOW);
    await putPresence(d1, g.id, mara.id, CORE.lat, CORE.lng, NOW);
    const lane = await listActiveSafetyPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW);
    const maraRow = lane[0].members.find((m) => m.displayName === "Mara")!;
    expect(maraRow.status).toBe("going");
    expect(maraRow.etaMinutes).toBe(8);
    expect(maraRow.distanceMeters).toBeGreaterThan(350);
  });

  it("'I'm okay' (close) ends the broadcast and clears the safety lane", async () => {
    const { owner, g } = await squadOf2();
    const sos = await dropSafety(g.id, owner.id);
    const ended = (await endMeetingPoint(d1, FESTIVAL_ID, g.id, sos.id, owner.id, "close", NOW))!;
    expect(ended.lifecycle).toBe("expired");
    expect((await listActiveSafetyPoints(d1, FESTIVAL_ID, g.id, owner.id, NOW)).length).toBe(0);
  });

  it("the cron purge never auto-fades a safety broadcast (it ends only on 'I'm okay')", async () => {
    const { owner, g } = await squadOf2();
    const sos = await dropSafety(g.id, owner.id);
    // Way past any regular grace window — a normal point would have faded; the safety point must not.
    const r = await purgeExpiredMeetingPoints(d1, "2026-07-18T22:00:00Z");
    expect(r.archived).toBe(0);
    const lane = await listActiveSafetyPoints(d1, FESTIVAL_ID, g.id, owner.id, "2026-07-18T22:00:00Z");
    expect(lane.map((p) => p.id)).toContain(sos.id);
  });
});
