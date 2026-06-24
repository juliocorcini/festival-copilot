// Meeting-point store (Pillar 3b, Phase 6 — UC-27, DEC-014/046/047). The DB is the source of truth;
// the GroupRoom DO only fans out a "meeting" change so clients refetch. A meeting point is the one
// place an exact coordinate is shared in V1 (DEC-046) — and only because its creator explicitly drops
// it for the squad. We store the exact lat/lng, then derive a coarse landmark label for copy by
// reusing the presence coarsener (domain/presence.ts) + the venue stage names. Photo deferred (DEC-047).

import { ulid } from "../db/ids";
import { getStageCoords } from "./presence";
import { listStages } from "./repo";
import { coarsenPresence, type StageCoord } from "../domain/presence";
import { clampGraceMinutes, landmarkLabel, meetingExpiry } from "../domain/meeting";
import type { MeetingPointDto, MeetingPointMemberDto } from "./dto";

/** A new meeting point coming from B4.2 (the exact spot is chosen on B4.1). */
export interface MeetingPointInput {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  title: string;
  note: string | null;
  /** ISO instant to meet at; null = "now". */
  meetAtUtc: string | null;
  /** Auto-close grace window after the meet time (minutes); defaults to 30 (DEC-014). */
  graceMinutes?: number | null;
}

interface MeetingPointRow {
  id: string;
  groupId: string;
  createdByUserId: string;
  createdByName: string | null;
  title: string | null;
  note: string | null;
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  meetAtUtc: string | null;
  expiresAtUtc: string;
  createdAtUtc: string;
}

interface MemberRow {
  mpId: string;
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  status: string;
  updatedAt: string;
}

/** Stage-name lookup + coords for one festival, fetched once per read (label + future ETA reuse). */
async function venueLabelContext(
  db: D1Database,
  festivalId: string
): Promise<{ coords: StageCoord[]; nameById: Map<string, string> }> {
  const [coords, stages] = await Promise.all([getStageCoords(db, festivalId), listStages(db, festivalId)]);
  return { coords, nameById: new Map(stages.map((s) => [s.id, s.name])) };
}

function memberDto(row: MemberRow, meId: string): MeetingPointMemberDto {
  return {
    userId: row.userId,
    displayName: row.displayName,
    avatarColor: row.avatarColor,
    isYou: row.userId === meId,
    status: row.status as MeetingPointMemberDto["status"],
    updatedAtUtc: row.updatedAt,
  };
}

/** Load the responder rows for a set of meeting points in one query, grouped by point id. */
async function loadMembers(db: D1Database, mpIds: string[]): Promise<Map<string, MemberRow[]>> {
  const byId = new Map<string, MemberRow[]>();
  if (mpIds.length === 0) return byId;
  const placeholders = mpIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT mm.meeting_point_id AS mpId, mm.user_id AS userId, mm.status AS status,
              mm.updated_at_utc AS updatedAt, u.display_name AS displayName, u.avatar_color AS avatarColor
         FROM meeting_point_member mm
         JOIN app_user u ON u.id = mm.user_id
        WHERE mm.meeting_point_id IN (${placeholders})
        ORDER BY mm.updated_at_utc ASC`
    )
    .bind(...mpIds)
    .all<MemberRow>();
  for (const r of results) {
    const list = byId.get(r.mpId) ?? [];
    list.push(r);
    byId.set(r.mpId, list);
  }
  return byId;
}

function toDto(
  row: MeetingPointRow,
  memberRows: MemberRow[],
  ctx: { coords: StageCoord[]; nameById: Map<string, string> },
  meId: string
): MeetingPointDto {
  const coarse = coarsenPresence({ lat: row.lat, lng: row.lng }, ctx.coords, row.accuracyMeters);
  const members = memberRows.map((m) => memberDto(m, meId));
  return {
    id: row.id,
    groupId: row.groupId,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    isMine: row.createdByUserId === meId,
    title: row.title ?? "Meeting point",
    note: row.note,
    lat: row.lat,
    lng: row.lng,
    landmarkLabel: landmarkLabel(coarse, ctx.nameById),
    meetAtUtc: row.meetAtUtc,
    expiresAtUtc: row.expiresAtUtc,
    createdAtUtc: row.createdAtUtc,
    members,
    goingCount: members.filter((m) => m.status === "going").length,
    hereCount: members.filter((m) => m.status === "arrived").length,
    myStatus: members.find((m) => m.isYou)?.status ?? null,
  };
}

const SELECT_POINT = `SELECT mp.id AS id, mp.group_id AS groupId, mp.created_by_user_id AS createdByUserId,
        u.display_name AS createdByName, mp.title AS title, mp.note AS note, mp.lat AS lat, mp.lng AS lng,
        mp.accuracy_meters AS accuracyMeters, mp.meet_at_utc AS meetAtUtc, mp.expires_at_utc AS expiresAtUtc,
        mp.created_at_utc AS createdAtUtc
   FROM meeting_point mp
   JOIN app_user u ON u.id = mp.created_by_user_id`;

/**
 * Create a "come to me" meeting point (B4.2). Stores the exact spot, derives the landmark label, and
 * marks the creator as "going". Returns the full DTO (so the create flow can route to the detail).
 */
export async function createMeetingPoint(
  db: D1Database,
  festivalId: string,
  groupId: string,
  userId: string,
  input: MeetingPointInput,
  nowIso: string
): Promise<MeetingPointDto> {
  const id = ulid();
  const meetAtMs = input.meetAtUtc ? Date.parse(input.meetAtUtc) : null;
  const expiresIso = new Date(
    meetingExpiry(Number.isFinite(meetAtMs as number) ? meetAtMs : null, Date.parse(nowIso), clampGraceMinutes(input.graceMinutes))
  ).toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO meeting_point
           (id, group_id, created_by_user_id, title, note, lat, lng, accuracy_meters, visibility, status,
            is_safety, created_at_utc, expires_at_utc, meet_at_utc)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'group', 'active', 0, ?, ?, ?)`
      )
      .bind(
        id,
        groupId,
        userId,
        input.title,
        input.note,
        input.lat,
        input.lng,
        input.accuracyMeters,
        nowIso,
        expiresIso,
        input.meetAtUtc
      ),
    db
      .prepare(
        `INSERT INTO meeting_point_member (meeting_point_id, user_id, status, updated_at_utc)
         VALUES (?, ?, 'going', ?)`
      )
      .bind(id, userId, nowIso),
  ]);
  const created = await getMeetingPoint(db, festivalId, groupId, id, userId);
  // The row was just written in this same DB; this is only null under a concurrent delete.
  if (!created) throw new Error("meeting point vanished after create");
  return created;
}

/** A single meeting point (any status) for a squad, or null when it isn't this group's. */
export async function getMeetingPoint(
  db: D1Database,
  festivalId: string,
  groupId: string,
  mpId: string,
  meId: string
): Promise<MeetingPointDto | null> {
  const row = await db
    .prepare(`${SELECT_POINT} WHERE mp.id = ? AND mp.group_id = ?`)
    .bind(mpId, groupId)
    .first<MeetingPointRow>();
  if (!row) return null;
  const [members, ctx] = await Promise.all([loadMembers(db, [mpId]), venueLabelContext(db, festivalId)]);
  return toDto(row, members.get(mpId) ?? [], ctx, meId);
}

/**
 * The squad's ACTIVE meeting points (not archived, not yet expired), newest first. Safety broadcasts
 * (is_safety = 1, Gate 6.3) are excluded — they surface in their own safety lane.
 */
export async function listMeetingPoints(
  db: D1Database,
  festivalId: string,
  groupId: string,
  meId: string,
  nowIso: string
): Promise<MeetingPointDto[]> {
  const { results: rows } = await db
    .prepare(
      `${SELECT_POINT}
        WHERE mp.group_id = ? AND mp.is_safety = 0 AND mp.status != 'archived' AND mp.expires_at_utc > ?
        ORDER BY mp.created_at_utc DESC`
    )
    .bind(groupId, nowIso)
    .all<MeetingPointRow>();
  if (rows.length === 0) return [];
  const [membersById, ctx] = await Promise.all([
    loadMembers(db, rows.map((r) => r.id)),
    venueLabelContext(db, festivalId),
  ]);
  return rows.map((r) => toDto(r, membersById.get(r.id) ?? [], ctx, meId));
}
