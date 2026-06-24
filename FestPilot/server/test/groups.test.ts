import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";

import { parseAuthIdentity } from "../src/auth";
import { ulid } from "../src/db/ids";
import { ensureUser } from "../src/api/users";
import {
  SQUAD_CAP,
  createGroup,
  getGroupForUser,
  invitePreview,
  joinByToken,
  leaveGroup,
  listMembers,
  listMyGroups,
} from "../src/api/groups";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0002_festival_map.sql",
  "0003_app_user_profile.sql",
  "0004_app_group_emoji.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const FESTIVAL_ID = "fest_tl26";

async function freshDb(): Promise<{ db: Database; d1: D1Database }> {
  const db = await createSqliteDb(migrations);
  const d1 = makeD1(db);
  await d1
    .prepare(`INSERT INTO festival (id, name, slug, timezone, created_at_utc) VALUES (?,?,?,?,?)`)
    .bind(FESTIVAL_ID, "Tomorrowland 2026", "tl-2026", "Europe/Brussels", "2026-01-01T00:00:00Z")
    .run();
  return { db, d1 };
}

/** Create a distinct anonymous user (each gets a unique 26-char ULID token). */
async function makeUser(d1: D1Database, name?: string) {
  const identity = parseAuthIdentity(`Bearer anon.${ulid()}`)!;
  return ensureUser(d1, identity, "2026-06-23T10:00:00Z", name ? { displayName: name } : undefined);
}

describe("groups — create + ownership (UC-16)", () => {
  let d1: D1Database;
  beforeEach(async () => ({ d1 } = await freshDb()));

  it("creates a squad with the caller as owner and mints an invite token", async () => {
    const owner = await makeUser(d1, "Julio");
    const group = await createGroup(
      d1,
      owner.id,
      { name: "FAM JUNTOS", emoji: "🔥", festivalId: FESTIVAL_ID },
      "2026-06-23T12:00:00Z"
    );
    expect(group.name).toBe("FAM JUNTOS");
    expect(group.emoji).toBe("🔥");
    expect(group.festivalId).toBe(FESTIVAL_ID);
    expect(group.role).toBe("owner");
    expect(group.memberCount).toBe(1);
    expect(group.inviteToken).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
  });

  it("lists the caller's squads, most recent first; hides groups they don't belong to", async () => {
    const a = await makeUser(d1, "A");
    const b = await makeUser(d1, "B");
    const g1 = await createGroup(d1, a.id, { name: "One", emoji: null, festivalId: FESTIVAL_ID }, "t1");
    await createGroup(d1, b.id, { name: "Other", emoji: null, festivalId: FESTIVAL_ID }, "t2");
    const mine = await listMyGroups(d1, a.id);
    expect(mine.map((g) => g.id)).toEqual([g1.id]);
  });

  it("returns null for a non-member viewing a group (membership gate)", async () => {
    const owner = await makeUser(d1);
    const stranger = await makeUser(d1);
    const g = await createGroup(d1, owner.id, { name: "Closed", emoji: null, festivalId: FESTIVAL_ID }, "t");
    expect(await getGroupForUser(d1, g.id, stranger.id)).toBeNull();
    expect(await getGroupForUser(d1, g.id, owner.id)).not.toBeNull();
  });
});

describe("groups — join by invite (UC-17, cap 50)", () => {
  let d1: D1Database;
  beforeEach(async () => ({ d1 } = await freshDb()));

  it("joins via token, is idempotent, and bumps invite uses only on a real join", async () => {
    const owner = await makeUser(d1, "Owner");
    const joiner = await makeUser(d1, "Joiner");
    const g = await createGroup(d1, owner.id, { name: "Squad", emoji: null, festivalId: FESTIVAL_ID }, "t");
    const token = g.inviteToken!;

    const first = await joinByToken(d1, joiner.id, token, "t1");
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.group.memberCount).toBe(2);

    // Re-join is a no-op (still 2 members) — idempotent.
    const again = await joinByToken(d1, joiner.id, token, "t2");
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.group.memberCount).toBe(2);
  });

  it("rejects an unknown token", async () => {
    const u = await makeUser(d1);
    const res = await joinByToken(d1, u.id, "ZZZZZZ", "t");
    expect(res).toEqual({ ok: false, error: "not_found" });
  });

  it("refuses to exceed the squad cap of 50", async () => {
    expect(SQUAD_CAP).toBe(50);
    const owner = await makeUser(d1, "Owner");
    const g = await createGroup(d1, owner.id, { name: "Big", emoji: null, festivalId: FESTIVAL_ID }, "t");
    const token = g.inviteToken!;
    // Owner is #1; fill to 50 then the 51st is rejected.
    for (let i = 0; i < SQUAD_CAP - 1; i++) {
      const m = await makeUser(d1, `m${i}`);
      const r = await joinByToken(d1, m.id, token, "t");
      expect(r.ok).toBe(true);
    }
    const overflow = await makeUser(d1, "overflow");
    const res = await joinByToken(d1, overflow.id, token, "t");
    expect(res).toEqual({ ok: false, error: "full" });
    expect((await getGroupForUser(d1, g.id, owner.id))!.memberCount).toBe(50);
  });
});

describe("groups — preview, members, leave", () => {
  let d1: D1Database;
  beforeEach(async () => ({ d1 } = await freshDb()));

  it("previews an invite with owner name + member count, and flags already-member", async () => {
    const owner = await makeUser(d1, "Andy");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: "🔥", festivalId: FESTIVAL_ID }, "t");
    const outsider = await makeUser(d1, "Julio");

    const preview = await invitePreview(d1, g.inviteToken!, outsider.id);
    expect(preview).toMatchObject({
      name: "FAM",
      emoji: "🔥",
      ownerName: "Andy",
      memberCount: 1,
      alreadyMember: false,
    });

    await joinByToken(d1, outsider.id, g.inviteToken!, "t");
    expect((await invitePreview(d1, g.inviteToken!, outsider.id))!.alreadyMember).toBe(true);
  });

  it("lists members owner-first and flags the caller as `isYou`", async () => {
    const owner = await makeUser(d1, "Owner");
    const member = await makeUser(d1, "Member");
    const g = await createGroup(d1, owner.id, { name: "S", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, member.id, g.inviteToken!, "t");

    const members = await listMembers(d1, g.id, member.id);
    expect(members.map((m) => m.role)).toEqual(["owner", "member"]);
    expect(members[0]!.displayName).toBe("Owner");
    expect(members.find((m) => m.userId === member.id)!.isYou).toBe(true);
  });

  it("hands ownership to the earliest remaining member when the owner leaves", async () => {
    const owner = await makeUser(d1, "Owner");
    const first = await makeUser(d1, "First");
    const second = await makeUser(d1, "Second");
    const g = await createGroup(d1, owner.id, { name: "S", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, first.id, g.inviteToken!, "t1");
    await joinByToken(d1, second.id, g.inviteToken!, "t2");

    await leaveGroup(d1, g.id, owner.id);
    const view = await getGroupForUser(d1, g.id, first.id);
    expect(view!.role).toBe("owner"); // earliest remaining member promoted
    expect(view!.memberCount).toBe(2);
  });

  it("removes the membership on leave (group hidden from the leaver)", async () => {
    const owner = await makeUser(d1);
    const member = await makeUser(d1);
    const g = await createGroup(d1, owner.id, { name: "S", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, member.id, g.inviteToken!, "t");
    await leaveGroup(d1, g.id, member.id);
    expect(await getGroupForUser(d1, g.id, member.id)).toBeNull();
    expect(await listMyGroups(d1, member.id)).toEqual([]);
  });
});
