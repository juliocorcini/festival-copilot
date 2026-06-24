import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { beforeEach, describe, expect, it } from "vitest";

import { parseAuthIdentity } from "../src/auth";
import { ulid } from "../src/db/ids";
import { ensureUser } from "../src/api/users";
import { createGroup, joinByToken } from "../src/api/groups";
import { editNote, listNotes, postNote, removeNote, setPinned } from "../src/api/board";
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

async function freshDb(): Promise<D1Database> {
  const db: Database = await createSqliteDb(migrations);
  const d1 = makeD1(db);
  await d1
    .prepare(`INSERT INTO festival (id, name, slug, timezone, created_at_utc) VALUES (?,?,?,?,?)`)
    .bind(FESTIVAL_ID, "Tomorrowland 2026", "tl-2026", "Europe/Brussels", "2026-01-01T00:00:00Z")
    .run();
  return d1;
}

async function makeUser(d1: D1Database, name: string) {
  const identity = parseAuthIdentity(`Bearer anon.${ulid()}`)!;
  return ensureUser(d1, identity, "2026-06-23T10:00:00Z", { displayName: name });
}

describe("group board — post / list (#UC-39)", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("posts a note and lists it with the author's identity + isMine", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: "🔥", festivalId: FESTIVAL_ID }, "t");

    const created = await postNote(d1, g.id, owner.id, "Meet at the windmill at 6", "2026-06-23T12:00:00Z");
    expect(created.body).toBe("Meet at the windmill at 6");
    expect(created.pinned).toBe(false);

    const notes = await listNotes(d1, g.id, owner.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.authorName).toBe("Julio");
    expect(notes[0]!.isMine).toBe(true);
    expect(notes[0]!.updatedAtUtc).toBeNull();
  });

  it("orders pinned notes first, then newest-first", async () => {
    const owner = await makeUser(d1, "Julio");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");

    const a = await postNote(d1, g.id, owner.id, "first", "2026-06-23T10:00:00Z");
    const b = await postNote(d1, g.id, owner.id, "second", "2026-06-23T11:00:00Z");
    const c = await postNote(d1, g.id, owner.id, "third", "2026-06-23T12:00:00Z");

    // Pin the oldest — it should float to the top despite being the oldest.
    await setPinned(d1, g.id, a.id, true);

    const notes = await listNotes(d1, g.id, owner.id);
    expect(notes.map((n) => n.body)).toEqual(["first", "third", "second"]);
    expect(notes[0]!.pinned).toBe(true);
    // The two unpinned ones stay newest-first.
    expect(notes[1]!.id).toBe(c.id);
    expect(notes[2]!.id).toBe(b.id);
  });

  it("isMine is false for other members' notes", async () => {
    const owner = await makeUser(d1, "Owner");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");

    await postNote(d1, g.id, mara.id, "Mara's note", "2026-06-23T12:00:00Z");
    const seenByOwner = await listNotes(d1, g.id, owner.id);
    expect(seenByOwner[0]!.isMine).toBe(false);
    expect(seenByOwner[0]!.authorName).toBe("Mara");
  });
});

describe("group board — edit / pin / remove permissions", () => {
  let d1: D1Database;
  beforeEach(async () => (d1 = await freshDb()));

  it("the author can edit their note (sets updated_at); others cannot", async () => {
    const owner = await makeUser(d1, "Owner");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");

    const note = await postNote(d1, g.id, mara.id, "typo here", "2026-06-23T12:00:00Z");

    // Owner is NOT the author → edit must fail.
    expect(await editNote(d1, g.id, note.id, owner.id, "hijacked", "2026-06-23T12:05:00Z")).toBe(false);
    // The author edits → succeeds and stamps updated_at.
    expect(await editNote(d1, g.id, note.id, mara.id, "fixed it", "2026-06-23T12:06:00Z")).toBe(true);

    const notes = await listNotes(d1, g.id, mara.id);
    expect(notes[0]!.body).toBe("fixed it");
    expect(notes[0]!.updatedAtUtc).toBe("2026-06-23T12:06:00Z");
  });

  it("the author removes their own note; a non-author non-owner cannot", async () => {
    const owner = await makeUser(d1, "Owner");
    const mara = await makeUser(d1, "Mara");
    const bruno = await makeUser(d1, "Bruno");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");
    await joinByToken(d1, bruno.id, g.inviteToken!, "t2");

    const note = await postNote(d1, g.id, mara.id, "Mara's note", "2026-06-23T12:00:00Z");

    // Bruno (member, not author, not owner) cannot remove it.
    expect(await removeNote(d1, g.id, note.id, bruno.id, false)).toBe(false);
    // Mara (author) removes it.
    expect(await removeNote(d1, g.id, note.id, mara.id, false)).toBe(true);
    expect(await listNotes(d1, g.id, mara.id)).toHaveLength(0);
  });

  it("the owner can remove anyone's note (moderation)", async () => {
    const owner = await makeUser(d1, "Owner");
    const mara = await makeUser(d1, "Mara");
    const g = await createGroup(d1, owner.id, { name: "FAM", emoji: null, festivalId: FESTIVAL_ID }, "t");
    await joinByToken(d1, mara.id, g.inviteToken!, "t1");

    const note = await postNote(d1, g.id, mara.id, "spam", "2026-06-23T12:00:00Z");
    expect(await removeNote(d1, g.id, note.id, owner.id, true)).toBe(true);
    expect(await listNotes(d1, g.id, owner.id)).toHaveLength(0);
  });
});
