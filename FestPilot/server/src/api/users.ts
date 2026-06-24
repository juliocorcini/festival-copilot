// User identity store. Upserts `app_user` from the auth seam and applies profile edits.
// The DB is the source of truth for cross-device identity (groups need it); the anonymous
// token only carries the stable `firebase_uid`.

import { ulid } from "../db/ids";
import type { AuthIdentity } from "../auth";
import type { UserDto } from "./dto";

export interface ProfileInput {
  displayName?: string | null;
  avatarColor?: string | null;
  avatarUrl?: string | null;
  locale?: string | null;
}

interface UserRow {
  id: string;
  firebase_uid: string;
  auth_provider: string;
  is_anonymous: number;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  locale: string | null;
}

const SELECT_COLS =
  "id, firebase_uid, auth_provider, is_anonymous, display_name, avatar_url, avatar_color, locale";

function toDto(row: UserRow): UserDto {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    avatarColor: row.avatar_color,
    isAnonymous: row.is_anonymous === 1,
    provider: row.auth_provider,
  };
}

async function findByUid(db: D1Database, firebaseUid: string): Promise<UserRow | null> {
  return db
    .prepare(`SELECT ${SELECT_COLS} FROM app_user WHERE firebase_uid = ?`)
    .bind(firebaseUid)
    .first<UserRow>();
}

function hasProfileEdit(profile: ProfileInput | undefined): profile is ProfileInput {
  if (!profile) return false;
  return [profile.displayName, profile.avatarColor, profile.avatarUrl, profile.locale].some(
    (v) => v != null
  );
}

/**
 * Resolve the `app_user` for an identity, creating it on first sight (anonymous-first). When a
 * profile is passed, the provided fields are applied (COALESCE — absent fields keep their value).
 */
export async function ensureUser(
  db: D1Database,
  identity: AuthIdentity,
  nowIso: string,
  profile?: ProfileInput
): Promise<UserDto> {
  const existing = await findByUid(db, identity.firebaseUid);

  if (!existing) {
    const id = ulid();
    await db
      .prepare(
        `INSERT INTO app_user
           (id, firebase_uid, auth_provider, is_anonymous, display_name, avatar_url, avatar_color, locale, created_at_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        identity.firebaseUid,
        identity.provider,
        identity.isAnonymous ? 1 : 0,
        profile?.displayName ?? null,
        profile?.avatarUrl ?? null,
        profile?.avatarColor ?? null,
        profile?.locale ?? null,
        nowIso
      )
      .run();
    return (await findByUid(db, identity.firebaseUid).then((r) => r && toDto(r)))!;
  }

  if (hasProfileEdit(profile)) {
    await db
      .prepare(
        `UPDATE app_user SET
           display_name = COALESCE(?, display_name),
           avatar_url   = COALESCE(?, avatar_url),
           avatar_color = COALESCE(?, avatar_color),
           locale       = COALESCE(?, locale)
         WHERE firebase_uid = ?`
      )
      .bind(
        profile.displayName ?? null,
        profile.avatarUrl ?? null,
        profile.avatarColor ?? null,
        profile.locale ?? null,
        identity.firebaseUid
      )
      .run();
    return (await findByUid(db, identity.firebaseUid).then((r) => r && toDto(r)))!;
  }

  return toDto(existing);
}

/** Look up a user DTO by internal id (used by the group repos to render members). */
export async function getUserById(db: D1Database, id: string): Promise<UserDto | null> {
  const row = await db.prepare(`SELECT ${SELECT_COLS} FROM app_user WHERE id = ?`).bind(id).first<UserRow>();
  return row ? toDto(row) : null;
}
