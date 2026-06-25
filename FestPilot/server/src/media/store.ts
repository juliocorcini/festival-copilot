/**
 * R2-backed media store (DEC-059). A thin adapter over the `MEDIA` R2 bucket so the rest of the
 * server never touches R2 directly — the provider stays swappable. Avatars now; meeting-point photos
 * ride the same store (DEC-047, R9.5).
 *
 * The APP — not the provider — enforces the quota (Cloudflare has no hard spend cap, only budget
 * alerts): an allowlisted content-type, a per-object byte ceiling, a global object-count ceiling, and
 * a total-byte budget. `checkMediaQuota` is the pure decision; `mediaUsage` reads the D1 ledger.
 */
import type { Env } from "../env";

/** Allowed image content-types → file extension. */
export const MEDIA_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_AVATAR_BYTES = 256 * 1024; // client compresses to ~150 KB; 256 KB is the hard ceiling
export const MAX_MEETING_PHOTO_BYTES = 512 * 1024; // a landmark photo; client compresses to ~400 KB
export const MAX_MAP_BASE_BYTES = 4 * 1024 * 1024; // an admin-uploaded festival base raster (operator-only, few)
export const MAX_MEDIA_OBJECTS = 50_000; // app object-count ceiling
export const MAX_MEDIA_TOTAL_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB app budget (R2 free tier = 10 GB)

const CACHE_IMMUTABLE = "public, max-age=31536000, immutable";

export interface MediaUsage {
  objectCount: number;
  totalBytes: number;
  /** Bytes of the object being replaced (null = a brand-new object). Lets a swap reuse its budget. */
  existingBytes: number | null;
}

export type QuotaVerdict = { ok: true; ext: string } | { ok: false; status: number; reason: string };

/**
 * Pure quota decision: allowlist + per-object cap + count ceiling + total-byte budget. Overwrite-aware
 * — when `existingBytes` is set, the object is a replacement (no count bump; budget swaps old for new).
 */
export function checkMediaQuota(
  contentType: string,
  byteLength: number,
  usage: MediaUsage,
  maxBytes: number = MAX_AVATAR_BYTES
): QuotaVerdict {
  const ext = MEDIA_CONTENT_TYPES[contentType];
  if (!ext) return { ok: false, status: 415, reason: "unsupported image type — use JPEG, PNG or WebP" };
  if (!Number.isFinite(byteLength) || byteLength <= 0) return { ok: false, status: 400, reason: "empty image" };
  if (byteLength > maxBytes) return { ok: false, status: 413, reason: "image too large" };

  const isNew = usage.existingBytes == null;
  if (isNew && usage.objectCount >= MAX_MEDIA_OBJECTS) {
    return { ok: false, status: 507, reason: "media storage is full" };
  }
  const projectedTotal = usage.totalBytes - (usage.existingBytes ?? 0) + byteLength;
  if (projectedTotal > MAX_MEDIA_TOTAL_BYTES) return { ok: false, status: 507, reason: "media budget reached" };

  return { ok: true, ext };
}

/** Read the media ledger: total objects + bytes, and the size of `replacingKey` if it exists. */
export async function mediaUsage(db: D1Database, replacingKey: string | null): Promise<MediaUsage> {
  const totals = await db
    .prepare(`SELECT count(*) AS n, COALESCE(SUM(byte_size), 0) AS b FROM media_object`)
    .first<{ n: number; b: number }>();
  let existingBytes: number | null = null;
  if (replacingKey) {
    const row = await db
      .prepare(`SELECT byte_size AS b FROM media_object WHERE key = ?`)
      .bind(replacingKey)
      .first<{ b: number }>();
    existingBytes = row ? Number(row.b) : null;
  }
  return { objectCount: Number(totals?.n ?? 0), totalBytes: Number(totals?.b ?? 0), existingBytes };
}

/** Record a stored object in the ledger (one row per object). */
export async function recordMediaObject(
  db: D1Database,
  row: { key: string; kind: "avatar" | "meeting"; ownerUserId: string | null; byteSize: number; contentType: string },
  nowIso: string
): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO media_object (key, kind, owner_user_id, byte_size, content_type, created_at_utc)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(row.key, row.kind, row.ownerUserId, row.byteSize, row.contentType, nowIso)
    .run();
}

/** Drop a ledger row (used when an avatar is replaced). */
export async function forgetMediaObject(db: D1Database, key: string): Promise<void> {
  await db.prepare(`DELETE FROM media_object WHERE key = ?`).bind(key).run();
}

// --- R2 adapter (the only place that touches the bucket) ---

export async function putImage(env: Env, key: string, body: ArrayBuffer, contentType: string): Promise<void> {
  await env.MEDIA.put(key, body, { httpMetadata: { contentType, cacheControl: CACHE_IMMUTABLE } });
}

export async function getImage(env: Env, key: string): Promise<R2ObjectBody | null> {
  return env.MEDIA.get(key);
}

export async function deleteImage(env: Env, key: string): Promise<void> {
  await env.MEDIA.delete(key);
}

/** Extract the R2 key from a stored media URL (`https://host/media/<key>`); null when not a media URL. */
export function mediaKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/media/";
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}
