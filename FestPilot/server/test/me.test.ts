import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";

import { parseAuthIdentity, type AuthIdentity } from "../src/auth";
import { ensureUser, getUserById } from "../src/api/users";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = ["0001_init.sql", "0002_festival_map.sql", "0003_app_user_profile.sql", "0010_app_user_identity.sql"]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

async function freshDb(): Promise<{ db: Database; d1: D1Database }> {
  const db = await createSqliteDb(migrations);
  return { db, d1: makeD1(db) };
}

const ULID = "01J0AZ1234567890ABCDEFGHJK"; // 26 Crockford chars

describe("auth seam — parseAuthIdentity (DEC-024)", () => {
  it("derives an anonymous identity from a well-formed anon token", () => {
    const id = parseAuthIdentity(`Bearer anon.${ULID}`);
    expect(id).toEqual<AuthIdentity>({
      firebaseUid: `anon:${ULID}`,
      provider: "anonymous",
      isAnonymous: true,
    });
  });

  it("is case-insensitive on the Bearer scheme and trims surrounding space", () => {
    expect(parseAuthIdentity(`  bearer   anon.${ULID}  `)?.firebaseUid).toBe(`anon:${ULID}`);
  });

  it("rejects missing, non-bearer, empty, and malformed tokens", () => {
    expect(parseAuthIdentity(null)).toBeNull();
    expect(parseAuthIdentity(undefined)).toBeNull();
    expect(parseAuthIdentity("anon." + ULID)).toBeNull(); // no Bearer scheme
    expect(parseAuthIdentity("Bearer ")).toBeNull();
    expect(parseAuthIdentity("Bearer anon.not-a-ulid")).toBeNull();
    expect(parseAuthIdentity("Bearer eyJhbGciOi.fake.jwt")).toBeNull(); // future Firebase path
  });
});

describe("user store — ensureUser (DEC-024 anonymous-first)", () => {
  const identity = parseAuthIdentity(`Bearer anon.${ULID}`)!;

  it("creates an anonymous user on first sight", async () => {
    const { d1 } = await freshDb();
    const user = await ensureUser(d1, identity, "2026-06-23T10:00:00Z");
    expect(user.isAnonymous).toBe(true);
    expect(user.provider).toBe("anonymous");
    expect(user.displayName).toBeNull();
    expect(user.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/i);
  });

  it("is idempotent by firebase_uid — same identity reuses the same row", async () => {
    const { db, d1 } = await freshDb();
    const a = await ensureUser(d1, identity, "2026-06-23T10:00:00Z");
    const b = await ensureUser(d1, identity, "2026-06-23T11:00:00Z");
    expect(b.id).toBe(a.id);
    const count = Number(db.exec("SELECT count(*) FROM app_user")[0]!.values[0]![0]);
    expect(count).toBe(1);
  });

  it("applies a profile edit (name + dot color) and looks up by id", async () => {
    const { d1 } = await freshDb();
    const created = await ensureUser(d1, identity, "2026-06-23T10:00:00Z");
    const updated = await ensureUser(d1, identity, "2026-06-23T10:05:00Z", {
      displayName: "Julio",
      avatarColor: "#F5A623",
    });
    expect(updated.id).toBe(created.id);
    expect(updated.displayName).toBe("Julio");
    expect(updated.avatarColor).toBe("#F5A623");
    expect((await getUserById(d1, created.id))?.displayName).toBe("Julio");
  });

  it("preserves existing fields on a partial update (COALESCE)", async () => {
    const { d1 } = await freshDb();
    await ensureUser(d1, identity, "t0", { displayName: "Julio", avatarColor: "#F5A623" });
    const after = await ensureUser(d1, identity, "t1", { avatarColor: "#0EA5E9" });
    expect(after.displayName).toBe("Julio"); // untouched
    expect(after.avatarColor).toBe("#0EA5E9"); // changed
  });
});

describe("lightweight identity (DEC-060) — email, country, last-seen", () => {
  const identity = parseAuthIdentity(`Bearer anon.${ULID}`)!;
  const readRow = (db: Database): { email: string | null; country: string | null; last_seen_utc: string | null } => {
    const r = db.exec("SELECT email, country, last_seen_utc FROM app_user LIMIT 1")[0]!.values[0]!;
    return { email: r[0] as string | null, country: r[1] as string | null, last_seen_utc: r[2] as string | null };
  };

  it("captures optional email + the edge country and stamps last-seen on first sight", async () => {
    const { db, d1 } = await freshDb();
    await ensureUser(d1, identity, "2026-06-24T10:00:00Z", { displayName: "Julio", email: "j@x.com" }, "BE");
    const row = readRow(db);
    expect(row).toEqual({ email: "j@x.com", country: "BE", last_seen_utc: "2026-06-24T10:00:00Z" });
  });

  it("email stays out of the shared UserDto (PII never leaked to group members)", async () => {
    const { d1 } = await freshDb();
    const dto = await ensureUser(d1, identity, "t0", { displayName: "Julio", email: "j@x.com" }, "BE");
    expect(dto).not.toHaveProperty("email");
    expect(dto).not.toHaveProperty("country");
  });

  it("refreshes last-seen on every touch but never overwrites a known country with null", async () => {
    const { db, d1 } = await freshDb();
    await ensureUser(d1, identity, "2026-06-24T10:00:00Z", { displayName: "Julio" }, "BE");
    // A later plain GET (no profile, no country header) must bump last-seen, keep the country.
    await ensureUser(d1, identity, "2026-06-24T12:30:00Z", undefined, null);
    const row = readRow(db);
    expect(row.last_seen_utc).toBe("2026-06-24T12:30:00Z");
    expect(row.country).toBe("BE");
  });

  it("email is COALESCE-preserved across a later edit that omits it", async () => {
    const { db, d1 } = await freshDb();
    await ensureUser(d1, identity, "t0", { displayName: "Julio", email: "j@x.com" }, "BE");
    await ensureUser(d1, identity, "t1", { displayName: "Julio C." }, "BE");
    expect(readRow(db).email).toBe("j@x.com");
  });
});
