// Group store (Pillar 3a — UC-16/17). The DB is the source of truth; the GroupRoom Durable
// Object only fans out "something changed" so clients re-fetch (see group/room.ts).
//
// Rules baked in here:
//   * Squad cap = 50 members (DEC-038). Join is idempotent and refuses a full squad.
//   * Invite token = short Crockford code; the link never expires until the event ends (DEC-038),
//     so invites carry no expiry / max-uses.
//   * Leaving owner hands ownership to the earliest-joined remaining member (no orphan squad).

import { ulid } from "../db/ids";
import type { GroupDto, GroupMemberDto, InvitePreviewDto } from "./dto";

export const SQUAD_CAP = 50;

const TOKEN_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32 (no I/L/O/U)
const TOKEN_LEN = 6;

/** Short, URL-safe invite code (e.g. "AB12CD") used in `festpilot.app/j/<token>` and the QR. */
function inviteToken(): string {
  const bytes = new Uint8Array(TOKEN_LEN);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < TOKEN_LEN; i++) out += TOKEN_ALPHABET[bytes[i]! & 0x1f];
  return out;
}

interface GroupRow {
  id: string;
  name: string;
  emoji: string | null;
  festivalId: string;
  createdBy: string;
  memberCount: number;
  myRole: string | null;
  token: string | null;
}

function toGroupDto(row: GroupRow): GroupDto {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    festivalId: row.festivalId,
    createdByUserId: row.createdBy,
    memberCount: Number(row.memberCount),
    role: row.myRole,
    inviteToken: row.token,
  };
}

const GROUP_SELECT = `
  SELECT g.id AS id, g.name AS name, g.emoji AS emoji, g.festival_id AS festivalId,
         g.created_by_user_id AS createdBy,
         (SELECT count(*) FROM group_member m WHERE m.group_id = g.id) AS memberCount,
         (SELECT role FROM group_member m WHERE m.group_id = g.id AND m.user_id = ?) AS myRole,
         (SELECT token FROM group_invite i WHERE i.group_id = g.id ORDER BY i.id ASC LIMIT 1) AS token
    FROM app_group g`;

/** The caller's view of one group. Returns null when the caller is not a member (membership gate). */
export async function getGroupForUser(
  db: D1Database,
  groupId: string,
  userId: string
): Promise<GroupDto | null> {
  const row = await db
    .prepare(`${GROUP_SELECT} WHERE g.id = ?`)
    .bind(userId, groupId)
    .first<GroupRow>();
  if (!row || row.myRole == null) return null;
  return toGroupDto(row);
}

/** Every squad the caller belongs to, most-recently-joined first. */
export async function listMyGroups(db: D1Database, userId: string): Promise<GroupDto[]> {
  const { results } = await db
    .prepare(
      `${GROUP_SELECT}
        JOIN group_member gm ON gm.group_id = g.id AND gm.user_id = ?
       ORDER BY gm.joined_at_utc DESC`
    )
    .bind(userId, userId)
    .all<GroupRow>();
  return results.map(toGroupDto);
}

export async function createGroup(
  db: D1Database,
  ownerId: string,
  input: { name: string; emoji: string | null; festivalId: string },
  nowIso: string
): Promise<GroupDto> {
  const id = ulid();
  await db
    .prepare(
      `INSERT INTO app_group (id, festival_id, name, emoji, created_by_user_id, created_at_utc)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, input.festivalId, input.name, input.emoji, ownerId, nowIso)
    .run();
  await db
    .prepare(
      `INSERT INTO group_member (group_id, user_id, role, joined_at_utc) VALUES (?, ?, 'owner', ?)`
    )
    .bind(id, ownerId, nowIso)
    .run();
  await db
    .prepare(
      `INSERT INTO group_invite (id, group_id, token, created_by_user_id) VALUES (?, ?, ?, ?)`
    )
    .bind(ulid(), id, inviteToken(), ownerId)
    .run();
  return (await getGroupForUser(db, id, ownerId))!;
}

interface MemberRow {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
}

/** The member list for a group, owner first then by join time. `isYou` flags the caller. */
export async function listMembers(
  db: D1Database,
  groupId: string,
  meId: string
): Promise<GroupMemberDto[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_color AS avatarColor, m.role AS role
         FROM group_member m
         JOIN app_user u ON u.id = m.user_id
        WHERE m.group_id = ?
        ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, m.joined_at_utc ASC`
    )
    .bind(groupId)
    .all<MemberRow>();
  return results.map((r) => ({
    userId: r.userId,
    displayName: r.displayName,
    avatarColor: r.avatarColor,
    role: r.role,
    isYou: r.userId === meId,
  }));
}

interface PreviewRow {
  token: string;
  groupId: string;
  name: string;
  emoji: string | null;
  festivalId: string;
  memberCount: number;
  ownerName: string | null;
}

/** Resolve an invite link/QR to its group, for the pre-join card (#23.6). Null when unknown. */
export async function invitePreview(
  db: D1Database,
  token: string,
  meId: string
): Promise<InvitePreviewDto | null> {
  const row = await db
    .prepare(
      `SELECT i.token AS token, g.id AS groupId, g.name AS name, g.emoji AS emoji,
              g.festival_id AS festivalId,
              (SELECT count(*) FROM group_member m WHERE m.group_id = g.id) AS memberCount,
              (SELECT u.display_name FROM group_member m JOIN app_user u ON u.id = m.user_id
                WHERE m.group_id = g.id AND m.role = 'owner' LIMIT 1) AS ownerName
         FROM group_invite i
         JOIN app_group g ON g.id = i.group_id
        WHERE i.token = ?`
    )
    .bind(token)
    .first<PreviewRow>();
  if (!row) return null;
  const mine = await db
    .prepare(`SELECT 1 AS x FROM group_member WHERE group_id = ? AND user_id = ?`)
    .bind(row.groupId, meId)
    .first<{ x: number }>();
  return {
    token: row.token,
    groupId: row.groupId,
    name: row.name,
    emoji: row.emoji,
    festivalId: row.festivalId,
    memberCount: Number(row.memberCount),
    ownerName: row.ownerName,
    alreadyMember: mine != null,
  };
}

export type JoinResult =
  | { ok: true; group: GroupDto }
  | { ok: false; error: "not_found" | "full" };

/** Join a squad by its invite token. Idempotent (re-join is a no-op) and enforces the cap. */
export async function joinByToken(
  db: D1Database,
  userId: string,
  token: string,
  nowIso: string
): Promise<JoinResult> {
  const inv = await db
    .prepare(`SELECT group_id AS groupId FROM group_invite WHERE token = ?`)
    .bind(token)
    .first<{ groupId: string }>();
  if (!inv) return { ok: false, error: "not_found" };

  const existing = await db
    .prepare(`SELECT 1 AS x FROM group_member WHERE group_id = ? AND user_id = ?`)
    .bind(inv.groupId, userId)
    .first<{ x: number }>();

  if (!existing) {
    const count = await db
      .prepare(`SELECT count(*) AS n FROM group_member WHERE group_id = ?`)
      .bind(inv.groupId)
      .first<{ n: number }>();
    if (Number(count?.n ?? 0) >= SQUAD_CAP) return { ok: false, error: "full" };
    await db
      .prepare(
        `INSERT INTO group_member (group_id, user_id, role, joined_at_utc) VALUES (?, ?, 'member', ?)`
      )
      .bind(inv.groupId, userId, nowIso)
      .run();
    await db.prepare(`UPDATE group_invite SET uses = uses + 1 WHERE token = ?`).bind(token).run();
  }

  return { ok: true, group: (await getGroupForUser(db, inv.groupId, userId))! };
}

/** Leave a squad. A leaving owner hands ownership to the earliest-joined remaining member. */
export async function leaveGroup(db: D1Database, groupId: string, userId: string): Promise<void> {
  const me = await db
    .prepare(`SELECT role FROM group_member WHERE group_id = ? AND user_id = ?`)
    .bind(groupId, userId)
    .first<{ role: string }>();
  if (!me) return;

  await db
    .prepare(`DELETE FROM group_member WHERE group_id = ? AND user_id = ?`)
    .bind(groupId, userId)
    .run();

  if (me.role === "owner") {
    const next = await db
      .prepare(
        `SELECT user_id AS userId FROM group_member WHERE group_id = ? ORDER BY joined_at_utc ASC LIMIT 1`
      )
      .bind(groupId)
      .first<{ userId: string }>();
    if (next) {
      await db
        .prepare(`UPDATE group_member SET role = 'owner' WHERE group_id = ? AND user_id = ?`)
        .bind(groupId, next.userId)
        .run();
    }
  }
}
