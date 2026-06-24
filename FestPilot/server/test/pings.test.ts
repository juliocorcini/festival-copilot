import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";

import { parseAuthIdentity } from "../src/auth";
import { ulid } from "../src/db/ids";
import { ensureUser } from "../src/api/users";
import { createGroup, joinByToken } from "../src/api/groups";
import { getGroupPresence, setGroupShareMode } from "../src/api/presence";
import { answerPing, dismissPing, listInbox, sendPing } from "../src/api/pings";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0002_festival_map.sql",
  "0003_app_user_profile.sql",
  "0004_app_group_emoji.sql",
  "0005_group_shared_plan.sql",
  "0006_presence_ping.sql",
  "0010_app_user_identity.sql",
  "0013_usage_metrics.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const FESTIVAL_ID = "fest_tl26";
const MAIN = { id: "main", name: "MAINSTAGE", lat: 51.0, lng: 4.0 };

async function freshDb(): Promise<D1Database> {
  const db: Database = await createSqliteDb(migrations);
  const d1 = makeD1(db);
  await d1
    .prepare(`INSERT INTO festival (id, name, slug, timezone, created_at_utc) VALUES (?,?,?,?,?)`)
    .bind(FESTIVAL_ID, "Tomorrowland 2026", "tl-2026", "Europe/Brussels", "2026-01-01T00:00:00Z")
    .run();
  await d1
    .prepare(`INSERT INTO stage (id, festival_id, source_stage_id, name, sort_order) VALUES (?,?,?,?,?)`)
    .bind(MAIN.id, FESTIVAL_ID, MAIN.id, MAIN.name, 0)
    .run();
  const transform = {
    festival: "tl",
    venue: "de schorre",
    canvas: { width: 1000, height: 1000 },
    bbox: { west: 3.9, east: 4.1, south: 50.9, north: 51.1 },
    affine: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
    stages: [{ name: MAIN.name, lng: MAIN.lng, lat: MAIN.lat, matched: true }],
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

describe("where-is-everyone ping round-trip (UC-25/26)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("delivers a ping to the addressee's inbox only, and dedupes repeats", async () => {
    const owner = await makeUser(d1, "Julio");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");

    const id1 = await sendPing(d1, g.id, owner.id, mara.id, "locate", NOW);
    // A second identical ping inside the dedupe window reuses the same pending request.
    const id2 = await sendPing(d1, g.id, owner.id, mara.id, "locate", "2026-07-18T20:31:00Z");
    expect(id2).toBe(id1);

    const maraInbox = await listInbox(d1, g.id, mara.id, NOW);
    expect(maraInbox).toHaveLength(1);
    expect(maraInbox[0]!.fromName).toBe("Julio");
    expect(maraInbox[0]!.kind).toBe("locate");

    // The asker has nothing in their own inbox.
    expect(await listInbox(d1, g.id, owner.id, NOW)).toHaveLength(0);
  });

  it("answering with a stage records a coarse push-reply and works with GPS off", async () => {
    const owner = await makeUser(d1, "Julio");
    const theo = await makeUser(d1, "Theo");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, theo.id, g.inviteToken!, "t1");
    // Theo is ghost (that's why he gets nudged) and never sends a device fix.
    await setGroupShareMode(d1, g.id, theo.id, "ghost", 60, NOW);

    const pingId = await sendPing(d1, g.id, owner.id, theo.id, "nudge", NOW);
    const ok = await answerPing(d1, g.id, pingId, theo.id, MAIN.id, NOW);
    expect(ok).toBe(true);

    // The reply un-ghosts Theo for this squad and places him coarsely at the chosen stage.
    const roster = await getGroupPresence(d1, g.id, owner.id, NOW);
    const theoEntry = roster.members.find((m) => m.userId === theo.id)!;
    expect(theoEntry.shareMode).toBe("stage");
    expect(theoEntry.presence?.coarseLabel).toBe("at");
    expect(theoEntry.presence?.stageName).toBe("MAINSTAGE");
    expect(theoEntry.presence?.source).toBe("push_reply");

    // The ping is no longer pending in Theo's inbox.
    expect(await listInbox(d1, g.id, theo.id, NOW)).toHaveLength(0);
    // And the answer never leaked a coordinate to the roster.
    expect(JSON.stringify(roster)).not.toContain('"lat"');
  });

  it("only the addressee can answer/dismiss; dismiss shares nothing", async () => {
    const owner = await makeUser(d1, "Julio");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");
    const pingId = await sendPing(d1, g.id, owner.id, mara.id, "locate", NOW);

    // The asker (not the addressee) cannot close someone else's ping.
    expect(await answerPing(d1, g.id, pingId, owner.id, MAIN.id, NOW)).toBe(false);

    // Mara dismisses it: it clears from her inbox and creates no presence.
    expect(await dismissPing(d1, g.id, pingId, mara.id, NOW)).toBe(true);
    expect(await listInbox(d1, g.id, mara.id, NOW)).toHaveLength(0);
    const roster = await getGroupPresence(d1, g.id, owner.id, NOW);
    expect(roster.members.find((m) => m.userId === mara.id)!.presence).toBeNull();
  });
});
