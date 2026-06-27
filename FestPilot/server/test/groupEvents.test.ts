import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";

import { parseAuthIdentity } from "../src/auth";
import { ulid } from "../src/db/ids";
import { ensureUser } from "../src/api/users";
import { createGroup, joinByToken } from "../src/api/groups";
import { getSquadPlanData, shareMyPlan } from "../src/api/squadPlan";
import {
  createGroupEvent,
  deleteGroupEvent,
  getGroupEvent,
  listGroupEvents,
  markEventSeen,
} from "../src/api/groupEvents";
import { MIN_EVENT_DURATION_MS } from "../src/domain/groupEvent";
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
  "0010_app_user_identity.sql",
  "0015_group_event.sql",
  "0016_group_plan_change.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const FESTIVAL_ID = "fest_tl26";
const MAIN = { id: "main", name: "MAINSTAGE" };
const CORE = { id: "core", name: "CORE" };
const NOW = "2026-07-18T15:00:00Z";

/** Minutes from NOW → an ISO instant (event windows are expressed relative to NOW). */
function at(offsetMin: number): string {
  return new Date(Date.parse(NOW) + offsetMin * 60_000).toISOString();
}

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
  return d1;
}

async function makeUser(d1: D1Database, name: string) {
  const identity = parseAuthIdentity(`Bearer anon.${ulid()}`)!;
  return ensureUser(d1, identity, NOW, { displayName: name });
}

/** Owner + one joined member, the common setup for the group-event tests. */
async function squad(d1: D1Database) {
  const owner = await makeUser(d1, "Julio");
  const group = await createGroup(d1, owner.id, { name: "FAM", emoji: "🔥", festivalId: FESTIVAL_ID }, NOW);
  const member = await makeUser(d1, "Ana");
  await joinByToken(d1, member.id, group.inviteToken!, NOW);
  return { owner, member, group };
}

describe("group events — create + read (Phase 8, D2)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("creates a fixed-time event: stored window, derived 'soon' lifecycle, stage name resolved", async () => {
    const { owner, group } = await squad(d1);
    const event = await createGroupEvent(
      d1,
      FESTIVAL_ID,
      group.id,
      owner.id,
      { title: "Squad photo 📸", note: "by the flag", stageId: MAIN.id, startsAtUtc: at(15), endsAtUtc: at(45) },
      NOW
    );

    expect(event.title).toBe("Squad photo 📸");
    expect(event.note).toBe("by the flag");
    expect(event.stageId).toBe(MAIN.id);
    expect(event.stageName).toBe("MAINSTAGE");
    expect(event.startsAtUtc).toBe(at(15));
    expect(event.endsAtUtc).toBe(at(45));
    expect(event.isMine).toBe(true);
    expect(event.canDelete).toBe(true);
    expect(event.memberCount).toBe(2);
    expect(event.seenCount).toBe(0);
    expect(event.mySeen).toBe(false);
    // starts in 15 min (≤ 30 min soon window) → "soon".
    expect(event.lifecycle).toBe("soon");
  });

  it("clamps a bad window: a missing/too-short end is floored to the minimum duration", async () => {
    const { owner, group } = await squad(d1);
    const noEnd = await createGroupEvent(
      d1,
      FESTIVAL_ID,
      group.id,
      owner.id,
      { title: "Meet", note: null, stageId: null, startsAtUtc: at(60), endsAtUtc: null },
      NOW
    );
    expect(Date.parse(noEnd.endsAtUtc) - Date.parse(noEnd.startsAtUtc)).toBe(MIN_EVENT_DURATION_MS);
    expect(noEnd.stageName).toBeNull();
    // 60 min out (> 30 min soon window) → "upcoming".
    expect(noEnd.lifecycle).toBe("upcoming");
  });

  it("lists upcoming + live events earliest-first and excludes past ones", async () => {
    const { owner, group } = await squad(d1);
    const mk = (title: string, startMin: number, endMin: number) =>
      createGroupEvent(d1, FESTIVAL_ID, group.id, owner.id, { title, note: null, stageId: null, startsAtUtc: at(startMin), endsAtUtc: at(endMin) }, NOW);
    await mk("upcoming", 120, 150);
    await mk("live", -10, 20);
    await mk("soon", 15, 45);
    await mk("past", -120, -60);

    const list = await listGroupEvents(d1, FESTIVAL_ID, group.id, owner.id, true, NOW);
    expect(list.map((e) => e.title)).toEqual(["live", "soon", "upcoming"]);
    expect(list.map((e) => e.lifecycle)).toEqual(["live", "soon", "upcoming"]);
  });
});

describe("group events — delete authorization (Q6)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("a non-creator, non-owner member cannot delete someone else's event", async () => {
    const { owner, member, group } = await squad(d1);
    const ev = await createGroupEvent(d1, FESTIVAL_ID, group.id, owner.id, { title: "Owner's", note: null, stageId: null, startsAtUtc: at(30), endsAtUtc: at(60) }, NOW);

    // The member sees it but cannot manage it.
    const seenByMember = await getGroupEvent(d1, FESTIVAL_ID, group.id, ev.id, member.id, false, NOW);
    expect(seenByMember?.isMine).toBe(false);
    expect(seenByMember?.canDelete).toBe(false);

    const ok = await deleteGroupEvent(d1, group.id, ev.id, member.id, false);
    expect(ok).toBe(false);
    expect(await getGroupEvent(d1, FESTIVAL_ID, group.id, ev.id, owner.id, true, NOW)).not.toBeNull();
  });

  it("the creator can delete their own event; the owner can delete anyone's", async () => {
    const { owner, member, group } = await squad(d1);
    const mine = await createGroupEvent(d1, FESTIVAL_ID, group.id, member.id, { title: "Member's", note: null, stageId: null, startsAtUtc: at(30), endsAtUtc: at(60) }, NOW);
    expect(await deleteGroupEvent(d1, group.id, mine.id, member.id, false)).toBe(true);
    expect(await getGroupEvent(d1, FESTIVAL_ID, group.id, mine.id, member.id, false, NOW)).toBeNull();

    const others = await createGroupEvent(d1, FESTIVAL_ID, group.id, member.id, { title: "Member's 2", note: null, stageId: null, startsAtUtc: at(30), endsAtUtc: at(60) }, NOW);
    // The owner (isOwner=true) can delete a member's event.
    expect(await deleteGroupEvent(d1, group.id, others.id, owner.id, true)).toBe(true);
  });
});

describe("group events — '✓ seen' acknowledgement", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("ticks seen once, is idempotent, and counts toward the squad tally", async () => {
    const { owner, member, group } = await squad(d1);
    const ev = await createGroupEvent(d1, FESTIVAL_ID, group.id, owner.id, { title: "Photo", note: null, stageId: null, startsAtUtc: at(30), endsAtUtc: at(60) }, NOW);

    const once = await markEventSeen(d1, FESTIVAL_ID, group.id, ev.id, member.id, false, NOW);
    expect(once?.seenCount).toBe(1);
    expect(once?.mySeen).toBe(true);
    expect(once?.memberCount).toBe(2);

    // Re-ticking is idempotent (no double count).
    const twice = await markEventSeen(d1, FESTIVAL_ID, group.id, ev.id, member.id, false, NOW);
    expect(twice?.seenCount).toBe(1);

    // The creator's own view still reflects the member's tick but mySeen stays false for them.
    const ownerView = await getGroupEvent(d1, FESTIVAL_ID, group.id, ev.id, owner.id, true, NOW);
    expect(ownerView?.seenCount).toBe(1);
    expect(ownerView?.mySeen).toBe(false);
  });
});

describe("group events — guardrail: never leak into the squad plan (roadmap §5)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("creating events does NOT change getSquadPlanData (the lock aggregation stays just the sets)", async () => {
    const { owner, member, group } = await squad(d1);
    const day = "2026-07-18";
    await shareMyPlan(d1, group.id, owner.id, { day, slots: [{ performanceId: "perf_a" }, { performanceId: "perf_b" }], shareFavorites: false, favoriteActKeys: [] }, NOW);
    await shareMyPlan(d1, group.id, member.id, { day, slots: [{ performanceId: "perf_b" }], shareFavorites: false, favoriteActKeys: [] }, NOW);

    const before = await getSquadPlanData(d1, group.id, owner.id, day);

    // Now drop several group events (including one on a stage and one "live" right now).
    await createGroupEvent(d1, FESTIVAL_ID, group.id, owner.id, { title: "Photo", note: null, stageId: MAIN.id, startsAtUtc: at(15), endsAtUtc: at(45) }, NOW);
    await createGroupEvent(d1, FESTIVAL_ID, group.id, member.id, { title: "Dinner", note: "tacos", stageId: null, startsAtUtc: at(-10), endsAtUtc: at(50) }, NOW);

    const after = await getSquadPlanData(d1, group.id, owner.id, day);

    // The aggregation never reads group_event, so the squad plan is byte-for-byte identical.
    expect(after).toEqual(before);
    // And the events are independently retrievable (sanity: they really were written).
    expect((await listGroupEvents(d1, FESTIVAL_ID, group.id, owner.id, true, NOW)).length).toBe(2);
  });
});
