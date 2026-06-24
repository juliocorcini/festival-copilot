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
  clearOverride,
  getSquadPlanData,
  setOverride,
  shareMyPlan,
  unshareMyPlan,
} from "../src/api/squadPlan";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0002_festival_map.sql",
  "0003_app_user_profile.sql",
  "0004_app_group_emoji.sql",
  "0005_group_shared_plan.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const FESTIVAL_ID = "fest_tl26";
const DAY = "SATURDAY";

async function freshDb(): Promise<D1Database> {
  const db: Database = await createSqliteDb(migrations);
  const d1 = makeD1(db);
  await d1
    .prepare(`INSERT INTO festival (id, name, slug, timezone, created_at_utc) VALUES (?,?,?,?,?)`)
    .bind(FESTIVAL_ID, "Tomorrowland 2026", "tl-2026", "Europe/Brussels", "2026-01-01T00:00:00Z")
    .run();
  // Performances the shared plans reference (FK: group_member_plan.performance_id -> performance.id).
  for (const [id, name] of [
    ["perf_charlotte", "Charlotte de Witte"],
    ["perf_artbat", "ARTBAT"],
    ["perf_adriatique", "Adriatique"],
    ["perf_sara", "Sara Landry"],
  ] as const) {
    await d1
      .prepare(
        `INSERT INTO performance (id, festival_id, source_performance_id, name, day) VALUES (?,?,?,?,?)`
      )
      .bind(id, FESTIVAL_ID, id, name, DAY)
      .run();
  }
  return d1;
}

async function makeUser(d1: D1Database, name: string) {
  const identity = parseAuthIdentity(`Bearer anon.${ulid()}`)!;
  return ensureUser(d1, identity, "2026-06-23T10:00:00Z", { displayName: name });
}

describe("squad plan — share my plan (#23.8)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("stores locked picks + favorites and reflects them in the squad-plan data", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: "🔥", festivalId: FESTIVAL_ID }, "t");

    await shareMyPlan(
      d1,
      g.id,
      owner.id,
      {
        day: DAY,
        slots: [{ performanceId: "perf_charlotte" }, { performanceId: "perf_artbat" }],
        shareFavorites: true,
        favoriteActKeys: ["act_adriatique", "act_sara"],
      },
      "2026-06-23T12:00:00Z"
    );

    const data = await getSquadPlanData(d1, g.id, owner.id, DAY);
    expect(data.memberCount).toBe(1);
    expect(data.sharedCount).toBe(1);
    const me = data.members[0]!;
    expect(me.isYou).toBe(true);
    expect(me.shared).toBe(true);
    expect(me.shareFavorites).toBe(true);
    expect(me.performanceIds.sort()).toEqual(["perf_artbat", "perf_charlotte"]);
    expect(me.favoriteActKeys.sort()).toEqual(["act_adriatique", "act_sara"]);
  });

  it("re-sharing replaces the day's picks (idempotent) without duplicating rows", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");

    await shareMyPlan(d1, g.id, owner.id, { day: DAY, slots: [{ performanceId: "perf_charlotte" }], shareFavorites: false, favoriteActKeys: [] }, "t1");
    await shareMyPlan(d1, g.id, owner.id, { day: DAY, slots: [{ performanceId: "perf_artbat" }, { performanceId: "perf_adriatique" }], shareFavorites: false, favoriteActKeys: [] }, "t2");

    const data = await getSquadPlanData(d1, g.id, owner.id, DAY);
    expect(data.members[0]!.performanceIds.sort()).toEqual(["perf_adriatique", "perf_artbat"]);
  });

  it("does not store favorites when the fallback toggle is off", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await shareMyPlan(d1, g.id, owner.id, { day: DAY, slots: [{ performanceId: "perf_charlotte" }], shareFavorites: false, favoriteActKeys: ["act_x"] }, "t");
    const data = await getSquadPlanData(d1, g.id, owner.id, DAY);
    expect(data.members[0]!.favoriteActKeys).toEqual([]);
    expect(data.members[0]!.shareFavorites).toBe(false);
  });

  it("unshare drops the member's plan and favorites and unsets the shared flag", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await shareMyPlan(d1, g.id, owner.id, { day: DAY, slots: [{ performanceId: "perf_charlotte" }], shareFavorites: true, favoriteActKeys: ["act_x"] }, "t");
    await unshareMyPlan(d1, g.id, owner.id);
    const data = await getSquadPlanData(d1, g.id, owner.id, DAY);
    expect(data.sharedCount).toBe(0);
    expect(data.members[0]!.shared).toBe(false);
    expect(data.members[0]!.performanceIds).toEqual([]);
    expect(data.members[0]!.favoriteActKeys).toEqual([]);
  });
});

describe("squad plan — aggregation inputs across members", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("returns each member's picks owner-first with the right shared/me flags", async () => {
    const owner = await makeUser(d1, "Owner");
    const m1 = await makeUser(d1, "Mara");
    const m2 = await makeUser(d1, "Bruno");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, m1.id, g.inviteToken!, "t1");
    await joinByToken(d1, m2.id, g.inviteToken!, "t2");

    await shareMyPlan(d1, g.id, owner.id, { day: DAY, slots: [{ performanceId: "perf_charlotte" }], shareFavorites: false, favoriteActKeys: [] }, "t");
    await shareMyPlan(d1, g.id, m1.id, { day: DAY, slots: [{ performanceId: "perf_charlotte" }], shareFavorites: false, favoriteActKeys: [] }, "t");
    // m2 has not shared yet.

    const data = await getSquadPlanData(d1, g.id, m2.id, DAY);
    expect(data.memberCount).toBe(3);
    expect(data.sharedCount).toBe(2);
    expect(data.members.map((m) => m.role)).toEqual(["owner", "member", "member"]);
    expect(data.members.find((m) => m.userId === m2.id)!.isYou).toBe(true);
    expect(data.members.find((m) => m.userId === m2.id)!.shared).toBe(false);
  });
});

describe("squad plan — owner override (#24.4)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("pins and reverts an owner override for a block", async () => {
    const owner = await makeUser(d1, "Owner");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");

    await setOverride(d1, g.id, DAY, "perf_artbat", "2026-06-23T12:00:00Z");
    expect((await getSquadPlanData(d1, g.id, owner.id, DAY)).overrides).toEqual(["perf_artbat"]);

    // Re-pinning the same block is idempotent (no duplicate rows).
    await setOverride(d1, g.id, DAY, "perf_artbat", "2026-06-23T12:05:00Z");
    expect((await getSquadPlanData(d1, g.id, owner.id, DAY)).overrides).toEqual(["perf_artbat"]);

    await clearOverride(d1, g.id, DAY, "perf_artbat");
    expect((await getSquadPlanData(d1, g.id, owner.id, DAY)).overrides).toEqual([]);
  });
});
