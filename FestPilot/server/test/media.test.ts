import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";

import {
  MAX_AVATAR_BYTES,
  MAX_MEDIA_OBJECTS,
  MAX_MEDIA_TOTAL_BYTES,
  checkMediaQuota,
  forgetMediaObject,
  mediaKeyFromUrl,
  mediaUsage,
  recordMediaObject,
} from "../src/media/store";
import { media } from "../src/api/media";
import { ensureUser } from "../src/api/users";
import { parseAuthIdentity } from "../src/auth";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = [
  "0001_init.sql",
  "0003_app_user_profile.sql",
  "0010_app_user_identity.sql",
  "0011_media_object.sql",
]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

async function freshDb(): Promise<{ db: Database; d1: D1Database }> {
  const db = await createSqliteDb(migrations);
  return { db, d1: makeD1(db) };
}

const ULID = "01J0AZ1234567890ABCDEFGHJK";
const AUTH = `Bearer anon.${ULID}`;
const ULID2 = "01J0AZ1234567890ABCDEFGHJM";
const AUTH2 = `Bearer anon.${ULID2}`;

// --- In-memory R2 mock (only the surface src/media/store.ts touches) ---
function makeR2() {
  const store = new Map<string, { body: ArrayBuffer; contentType: string }>();
  const bucket = {
    async put(key: string, body: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) {
      store.set(key, { body, contentType: opts?.httpMetadata?.contentType ?? "application/octet-stream" });
    },
    async get(key: string) {
      const hit = store.get(key);
      if (!hit) return null;
      return {
        body: hit.body,
        httpEtag: `"${key}"`,
        writeHttpMetadata: (h: Headers) => h.set("content-type", hit.contentType),
      };
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
  return { store, bucket: bucket as unknown as R2Bucket };
}

function envWith(d1: D1Database, bucket: R2Bucket) {
  return { DB: d1, MEDIA: bucket } as unknown as Parameters<typeof media.request>[2];
}

const png = (bytes: number) => new Uint8Array(bytes).fill(7).buffer;

describe("media quota — checkMediaQuota (DEC-059, pure)", () => {
  const empty = { objectCount: 0, totalBytes: 0, existingBytes: null };

  it("accepts the three allowed image types and maps the extension", () => {
    expect(checkMediaQuota("image/jpeg", 1000, empty)).toEqual({ ok: true, ext: "jpg" });
    expect(checkMediaQuota("image/png", 1000, empty)).toEqual({ ok: true, ext: "png" });
    expect(checkMediaQuota("image/webp", 1000, empty)).toEqual({ ok: true, ext: "webp" });
  });

  it("rejects unsupported types with 415", () => {
    expect(checkMediaQuota("image/gif", 1000, empty)).toMatchObject({ ok: false, status: 415 });
    expect(checkMediaQuota("application/pdf", 1000, empty)).toMatchObject({ ok: false, status: 415 });
    expect(checkMediaQuota("", 1000, empty)).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects an empty body with 400 and an oversized body with 413", () => {
    expect(checkMediaQuota("image/png", 0, empty)).toMatchObject({ ok: false, status: 400 });
    expect(checkMediaQuota("image/png", MAX_AVATAR_BYTES + 1, empty)).toMatchObject({ ok: false, status: 413 });
    expect(checkMediaQuota("image/png", MAX_AVATAR_BYTES, empty)).toMatchObject({ ok: true });
  });

  it("rejects a brand-new object once the global count ceiling is reached (507)", () => {
    const full = { objectCount: MAX_MEDIA_OBJECTS, totalBytes: 0, existingBytes: null };
    expect(checkMediaQuota("image/png", 100, full)).toMatchObject({ ok: false, status: 507 });
  });

  it("does NOT count-bump a replacement (overwrite reuses the slot)", () => {
    // At the ceiling, but this upload replaces an existing object → allowed.
    const replacingAtCeiling = { objectCount: MAX_MEDIA_OBJECTS, totalBytes: 5000, existingBytes: 4000 };
    expect(checkMediaQuota("image/png", 100, replacingAtCeiling)).toMatchObject({ ok: true });
  });

  it("enforces the total-byte budget, crediting the replaced object's bytes", () => {
    // total is 1 byte under budget; a new 2-byte object would exceed it.
    const nearBudget = { objectCount: 10, totalBytes: MAX_MEDIA_TOTAL_BYTES - 1, existingBytes: null };
    expect(checkMediaQuota("image/png", 2, nearBudget)).toMatchObject({ ok: false, status: 507 });
    // Same totals, but replacing a 10-byte object frees room for a 2-byte one.
    const swap = { objectCount: 10, totalBytes: MAX_MEDIA_TOTAL_BYTES - 1, existingBytes: 10 };
    expect(checkMediaQuota("image/png", 2, swap)).toMatchObject({ ok: true });
  });
});

describe("media key parsing — mediaKeyFromUrl", () => {
  it("extracts the key from a stored media URL", () => {
    expect(mediaKeyFromUrl("https://api.festpilot.app/media/avatars/abc-123.png")).toBe("avatars/abc-123.png");
    expect(mediaKeyFromUrl("http://localhost/media/avatars/x.jpg")).toBe("avatars/x.jpg");
  });
  it("returns null for non-media or empty URLs", () => {
    expect(mediaKeyFromUrl(null)).toBeNull();
    expect(mediaKeyFromUrl(undefined)).toBeNull();
    expect(mediaKeyFromUrl("https://example.com/avatar.png")).toBeNull();
  });
});

describe("media ledger — mediaUsage / record / forget (D1 accounting)", () => {
  it("tracks object count + total bytes and resolves a replacing key's size", async () => {
    const { d1 } = await freshDb();
    await recordMediaObject(d1, { key: "avatars/u-1.png", kind: "avatar", ownerUserId: "u", byteSize: 1000, contentType: "image/png" }, "t0");
    await recordMediaObject(d1, { key: "avatars/v-1.png", kind: "avatar", ownerUserId: "v", byteSize: 500, contentType: "image/png" }, "t0");

    const usage = await mediaUsage(d1, "avatars/u-1.png");
    expect(usage.objectCount).toBe(2);
    expect(usage.totalBytes).toBe(1500);
    expect(usage.existingBytes).toBe(1000);

    const noReplace = await mediaUsage(d1, "avatars/missing.png");
    expect(noReplace.existingBytes).toBeNull();

    await forgetMediaObject(d1, "avatars/u-1.png");
    const after = await mediaUsage(d1, null);
    expect(after.objectCount).toBe(1);
    expect(after.totalBytes).toBe(500);
  });
});

describe("avatar route — POST/DELETE /api/media/avatar (DEC-059)", () => {
  it("rejects an unauthenticated upload with 401", async () => {
    const { d1 } = await freshDb();
    const { bucket } = makeR2();
    const res = await media.request("/avatar", { method: "POST", body: png(100) }, envWith(d1, bucket));
    expect(res.status).toBe(401);
  });

  it("rejects an unsupported content-type with 415 and stores nothing", async () => {
    const { d1 } = await freshDb();
    const { store, bucket } = makeR2();
    const res = await media.request(
      "/avatar",
      { method: "POST", headers: { authorization: AUTH, "content-type": "image/gif" }, body: png(100) },
      envWith(d1, bucket)
    );
    expect(res.status).toBe(415);
    expect(store.size).toBe(0);
  });

  it("stores the avatar, points the user row at /media/<key>, and ledgers one object", async () => {
    const { d1 } = await freshDb();
    const { store, bucket } = makeR2();
    const res = await media.request(
      "/avatar",
      { method: "POST", headers: { authorization: AUTH, "content-type": "image/png" }, body: png(120) },
      envWith(d1, bucket)
    );
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as { user: { id: string; avatarUrl: string | null } };
    expect(user.avatarUrl).toMatch(/\/media\/avatars\/.+\.png$/);
    expect(user.avatarUrl).toContain(user.id);

    expect(store.size).toBe(1);
    expect((await mediaUsage(d1, null)).objectCount).toBe(1);
  });

  it("a second upload REPLACES the first (old object + ledger row dropped, count stays 1)", async () => {
    const { d1 } = await freshDb();
    const { store, bucket } = makeR2();
    const env = envWith(d1, bucket);
    const first = await media.request(
      "/avatar",
      { method: "POST", headers: { authorization: AUTH, "content-type": "image/png" }, body: png(120) },
      env
    );
    const firstUrl = ((await first.json()) as { user: { avatarUrl: string } }).user.avatarUrl;
    const firstKey = mediaKeyFromUrl(firstUrl)!;

    // A different timestamp guarantees a different versioned key.
    await new Promise((r) => setTimeout(r, 2));
    const second = await media.request(
      "/avatar",
      { method: "POST", headers: { authorization: AUTH, "content-type": "image/webp" }, body: png(80) },
      env
    );
    const secondUrl = ((await second.json()) as { user: { avatarUrl: string } }).user.avatarUrl;
    expect(secondUrl).not.toBe(firstUrl);
    expect(store.has(firstKey)).toBe(false); // old object purged
    expect(store.size).toBe(1);
    const usage = await mediaUsage(d1, null);
    expect(usage.objectCount).toBe(1);
    expect(usage.totalBytes).toBe(80); // only the new object's bytes remain
  });

  it("DELETE removes the photo and clears the user pointer", async () => {
    const { d1 } = await freshDb();
    const { store, bucket } = makeR2();
    const env = envWith(d1, bucket);
    await media.request(
      "/avatar",
      { method: "POST", headers: { authorization: AUTH, "content-type": "image/png" }, body: png(120) },
      env
    );
    const res = await media.request("/avatar", { method: "DELETE", headers: { authorization: AUTH } }, env);
    expect(res.status).toBe(200);
    const { user } = (await res.json()) as { user: { avatarUrl: string | null } };
    expect(user.avatarUrl).toBeNull();
    expect(store.size).toBe(0);
    expect((await mediaUsage(d1, null)).objectCount).toBe(0);
  });
});

describe("meeting-point photo route — POST /api/media/meeting/:id/photo (DEC-047/059)", () => {
  // Seed a meeting point owned by the AUTH user; FKs are off in sql.js so a bare group_id is fine.
  async function seedPoint(d1: D1Database): Promise<string> {
    const creator = await ensureUser(d1, parseAuthIdentity(AUTH)!, "2026-06-24T10:00:00Z");
    await d1
      .prepare(
        `INSERT INTO meeting_point (id, group_id, created_by_user_id, title, lat, lng, created_at_utc, expires_at_utc)
         VALUES ('mp1', 'g1', ?, 'Tree by FREEDOM', 51.0, 4.0, '2026-06-24T10:00:00Z', '2999-01-01T00:00:00Z')`
      )
      .bind(creator.id)
      .run();
    return "mp1";
  }

  it("404s an unknown meeting point", async () => {
    const { d1 } = await freshDb();
    const { bucket } = makeR2();
    const res = await media.request(
      "/meeting/nope/photo",
      { method: "POST", headers: { authorization: AUTH, "content-type": "image/jpeg" }, body: png(100) },
      envWith(d1, bucket)
    );
    expect(res.status).toBe(404);
  });

  it("403s a non-creator", async () => {
    const { d1 } = await freshDb();
    const { store, bucket } = makeR2();
    await seedPoint(d1);
    const res = await media.request(
      "/meeting/mp1/photo",
      { method: "POST", headers: { authorization: AUTH2, "content-type": "image/jpeg" }, body: png(100) },
      envWith(d1, bucket)
    );
    expect(res.status).toBe(403);
    expect(store.size).toBe(0);
  });

  it("stores the photo for the creator and points the meeting row at /media/meetings/<key>", async () => {
    const { d1 } = await freshDb();
    const { store, bucket } = makeR2();
    await seedPoint(d1);
    const res = await media.request(
      "/meeting/mp1/photo",
      { method: "POST", headers: { authorization: AUTH, "content-type": "image/jpeg" }, body: png(200) },
      envWith(d1, bucket)
    );
    expect(res.status).toBe(200);
    const { photoUrl } = (await res.json()) as { photoUrl: string };
    expect(photoUrl).toMatch(/\/media\/meetings\/mp1-\d+\.jpg$/);
    expect(store.size).toBe(1);
    const row = await d1.prepare(`SELECT photo_url AS p FROM meeting_point WHERE id = 'mp1'`).first<{ p: string }>();
    expect(row?.p).toBe(photoUrl);
    // Ledgered as a 'meeting' object.
    const led = await d1.prepare(`SELECT kind FROM media_object LIMIT 1`).first<{ kind: string }>();
    expect(led?.kind).toBe("meeting");
  });
});
