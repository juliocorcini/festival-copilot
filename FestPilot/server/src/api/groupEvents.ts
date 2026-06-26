// Group-event store (Phase 8, roadmap D2/Q5/Q6). The DB is the source of truth; the GroupRoom DO
// only fans out an "events" change so clients refetch (the exact same plumbing as meeting points).
// A group event is a fixed-time squad commitment ("photo at the Mainstage, 16:00–16:30"). It lives
// ALONGSIDE the squad plan — it is NEVER read by buildSquadPlan / getSquadPlanData, so the lock
// aggregation stays "just the sets". Any member creates one (Q6); the creator OR the squad owner
// deletes it. The live lifecycle is derived (domain/groupEvent); an optional "✓ seen" is additive.

import { ulid } from "../db/ids";
import { listStages } from "./repo";
import { eventLifecycle, normalizeEventWindow } from "../domain/groupEvent";
import type { GroupEventDto } from "./dto";

/** A new group event from the create sheet. `endsAtUtc` null = "use the default minimum window". */
export interface GroupEventInput {
  title: string;
  note: string | null;
  stageId: string | null;
  startsAtUtc: string;
  endsAtUtc: string | null;
}

interface GroupEventRow {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdByName: string | null;
  title: string;
  note: string | null;
  stageId: string | null;
  startsAtUtc: string;
  endsAtUtc: string;
  createdAtUtc: string;
  seenCount: number;
  mySeen: number;
}

const SELECT_EVENT = `SELECT ge.id AS id, ge.group_id AS groupId, ge.created_by_user_id AS createdByUserId,
        u.display_name AS createdByName, ge.title AS title, ge.note AS note, ge.stage_id AS stageId,
        ge.starts_at_utc AS startsAtUtc, ge.ends_at_utc AS endsAtUtc, ge.created_at_utc AS createdAtUtc,
        (SELECT COUNT(*) FROM group_event_seen s WHERE s.event_id = ge.id) AS seenCount,
        (SELECT COUNT(*) FROM group_event_seen s WHERE s.event_id = ge.id AND s.user_id = ?) AS mySeen
   FROM group_event ge
   JOIN app_user u ON u.id = ge.created_by_user_id`;

/** Stage-name lookup for one festival (the optional event stage → chip + "see on map"). */
async function stageNameMap(db: D1Database, festivalId: string): Promise<Map<string, string>> {
  const stages = await listStages(db, festivalId);
  return new Map(stages.map((s) => [s.id, s.name]));
}

/** The squad size, so the agenda can read "3 of 5 saw this". */
async function groupMemberCount(db: D1Database, groupId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM group_member WHERE group_id = ?`)
    .bind(groupId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Assemble the DTO from a row + lookups; `isOwner` is the caller's squad role (drives canDelete). */
function assembleDto(
  row: GroupEventRow,
  stageNames: ReadonlyMap<string, string>,
  meId: string,
  isOwner: boolean,
  memberCount: number,
  nowMs: number
): GroupEventDto {
  const isMine = row.createdByUserId === meId;
  return {
    id: row.id,
    groupId: row.groupId,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    isMine,
    canDelete: isMine || isOwner,
    title: row.title,
    note: row.note,
    stageId: row.stageId,
    stageName: row.stageId ? stageNames.get(row.stageId) ?? null : null,
    startsAtUtc: row.startsAtUtc,
    endsAtUtc: row.endsAtUtc,
    createdAtUtc: row.createdAtUtc,
    lifecycle: eventLifecycle(Date.parse(row.startsAtUtc), Date.parse(row.endsAtUtc), nowMs),
    seenCount: row.seenCount ?? 0,
    memberCount,
    mySeen: (row.mySeen ?? 0) > 0,
  };
}

/**
 * Create a fixed-time group event. The window is validated/clamped by the domain (ends always after
 * starts, within a sane span). Returns the full DTO so the create flow can render it immediately.
 */
export async function createGroupEvent(
  db: D1Database,
  festivalId: string,
  groupId: string,
  userId: string,
  input: GroupEventInput,
  nowIso: string
): Promise<GroupEventDto> {
  const id = ulid();
  const { startsMs, endsMs } = normalizeEventWindow(
    Date.parse(input.startsAtUtc),
    input.endsAtUtc ? Date.parse(input.endsAtUtc) : Number.NaN
  );
  await db
    .prepare(
      `INSERT INTO group_event
         (id, group_id, created_by_user_id, title, note, stage_id, starts_at_utc, ends_at_utc, created_at_utc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      groupId,
      userId,
      input.title,
      input.note,
      input.stageId,
      new Date(startsMs).toISOString(),
      new Date(endsMs).toISOString(),
      nowIso
    )
    .run();
  const created = await getGroupEvent(db, festivalId, groupId, id, userId, false, nowIso);
  // The row was just written in this same DB; this is only null under a concurrent delete.
  if (!created) throw new Error("group event vanished after create");
  return created;
}

/** One group event for a squad with its derived lifecycle + seen tally. Null when it isn't this group's. */
export async function getGroupEvent(
  db: D1Database,
  festivalId: string,
  groupId: string,
  eventId: string,
  meId: string,
  isOwner: boolean,
  nowIso: string
): Promise<GroupEventDto | null> {
  const row = await db
    .prepare(`${SELECT_EVENT} WHERE ge.id = ? AND ge.group_id = ?`)
    .bind(meId, eventId, groupId)
    .first<GroupEventRow>();
  if (!row) return null;
  const [stageNames, memberCount] = await Promise.all([stageNameMap(db, festivalId), groupMemberCount(db, groupId)]);
  return assembleDto(row, stageNames, meId, isOwner, memberCount, Date.parse(nowIso));
}

/**
 * The squad's upcoming + live events (not-yet-ended), earliest first. Past events drop out of the
 * agenda (like an archived meeting point). The result feeds the agenda screen, the squad-home card
 * and the squad-plan band — never the set aggregation.
 */
export async function listGroupEvents(
  db: D1Database,
  festivalId: string,
  groupId: string,
  meId: string,
  isOwner: boolean,
  nowIso: string
): Promise<GroupEventDto[]> {
  const { results: rows } = await db
    .prepare(`${SELECT_EVENT} WHERE ge.group_id = ? AND ge.ends_at_utc > ? ORDER BY ge.starts_at_utc ASC`)
    .bind(meId, groupId, nowIso)
    .all<GroupEventRow>();
  if (rows.length === 0) return [];
  const [stageNames, memberCount] = await Promise.all([stageNameMap(db, festivalId), groupMemberCount(db, groupId)]);
  const nowMs = Date.parse(nowIso);
  return rows.map((r) => assembleDto(r, stageNames, meId, isOwner, memberCount, nowMs));
}

/**
 * Delete an event — creator-only OR squad-owner (Q6; the route resolves `isOwner` from the caller's
 * role). Returns false when it isn't this group's or the caller isn't allowed, so the route can
 * answer 404 vs 403. The "✓ seen" rows are cleared first to keep the table tidy.
 */
export async function deleteGroupEvent(
  db: D1Database,
  groupId: string,
  eventId: string,
  userId: string,
  isOwner: boolean
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT created_by_user_id AS createdBy FROM group_event WHERE id = ? AND group_id = ?`)
    .bind(eventId, groupId)
    .first<{ createdBy: string }>();
  if (!row) return false;
  if (row.createdBy !== userId && !isOwner) return false;
  await db.batch([
    db.prepare(`DELETE FROM group_event_seen WHERE event_id = ?`).bind(eventId),
    db.prepare(`DELETE FROM group_event WHERE id = ? AND group_id = ?`).bind(eventId, groupId),
  ]);
  return true;
}

/** Tick (or re-tick) the caller's "✓ seen" on an event. Returns the refreshed DTO, or null if gone. */
export async function markEventSeen(
  db: D1Database,
  festivalId: string,
  groupId: string,
  eventId: string,
  userId: string,
  isOwner: boolean,
  nowIso: string
): Promise<GroupEventDto | null> {
  const exists = await db
    .prepare(`SELECT 1 AS ok FROM group_event WHERE id = ? AND group_id = ?`)
    .bind(eventId, groupId)
    .first<{ ok: number }>();
  if (!exists) return null;
  await db
    .prepare(
      `INSERT INTO group_event_seen (event_id, user_id, seen_at_utc)
       VALUES (?, ?, ?)
       ON CONFLICT (event_id, user_id) DO UPDATE SET seen_at_utc = excluded.seen_at_utc`
    )
    .bind(eventId, userId, nowIso)
    .run();
  return getGroupEvent(db, festivalId, groupId, eventId, userId, isOwner, nowIso);
}
