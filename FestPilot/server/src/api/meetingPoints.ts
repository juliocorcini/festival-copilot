// Meeting-point store (Pillar 3b, Phase 6 — UC-27, DEC-014/046/047). The DB is the source of truth;
// the GroupRoom DO only fans out a "meeting" change so clients refetch. A meeting point is the one
// place an exact coordinate is shared in V1 (DEC-046) — and only because its creator explicitly drops
// it for the squad. We store the exact lat/lng, then derive a coarse landmark label for copy by
// reusing the presence coarsener (domain/presence.ts) + the venue stage names. Photo deferred (DEC-047).

import { ulid } from "../db/ids";
import { getGroupRawFixes, getStageCoords } from "./presence";
import { listMembers } from "./groups";
import { listStages } from "./repo";
import { coarsenPresence, metersBetween, type StageCoord } from "../domain/presence";
import {
  clampGraceMinutes,
  creatorDrifted,
  landmarkLabel,
  meetingExpiry,
  meetingLifecycle,
  walkEtaMinutes,
} from "../domain/meeting";
import type { MeetingMemberStatus, MeetingPointDto, MeetingPointMemberDto } from "./dto";

/** Statuses a client may set on itself (the DB's "left" is unused in V1; "no_response" is synthesized). */
const SETTABLE_STATUSES = new Set<MeetingMemberStatus>(["going", "arrived", "not_going"]);
export function isSettableStatus(value: string): value is "going" | "arrived" | "not_going" {
  return SETTABLE_STATUSES.has(value as MeetingMemberStatus);
}

/** Keep an archived/cancelled point's "who went" record this long after expiry, then purge it (DEC-015). */
const PURGE_AFTER_EXPIRY_MS = 6 * 60 * 60_000;

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
  status: string;
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
    etaMinutes: null,
    distanceMeters: null,
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

/**
 * Assemble the DTO from a point row + its final roster (responders for the list cards; the FULL
 * squad for the detail). Counts, lifecycle and `myStatus` are all derived here so the list and detail
 * stay consistent. `creatorDrifted` is the detail-only smart prompt (false elsewhere).
 */
function assembleDto(
  row: MeetingPointRow,
  members: MeetingPointMemberDto[],
  ctx: { coords: StageCoord[]; nameById: Map<string, string> },
  meId: string,
  nowMs: number,
  drifted = false
): MeetingPointDto {
  const coarse = coarsenPresence({ lat: row.lat, lng: row.lng }, ctx.coords, row.accuracyMeters);
  const goingCount = members.filter((m) => m.status === "going").length;
  const hereCount = members.filter((m) => m.status === "arrived").length;
  const lifecycle = meetingLifecycle({
    dbStatus: row.status,
    expiresAtMs: Date.parse(row.expiresAtUtc),
    nowMs,
    onTheWayCount: goingCount,
    hereCount,
  });
  const mine = members.find((m) => m.isYou);
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
    goingCount,
    hereCount,
    myStatus: mine && mine.status !== "no_response" ? mine.status : null,
    lifecycle,
    everyoneHere: lifecycle === "everyone_here",
    creatorDrifted: drifted,
  };
}

const SELECT_POINT = `SELECT mp.id AS id, mp.group_id AS groupId, mp.created_by_user_id AS createdByUserId,
        u.display_name AS createdByName, mp.title AS title, mp.note AS note, mp.lat AS lat, mp.lng AS lng,
        mp.accuracy_meters AS accuracyMeters, mp.status AS status, mp.meet_at_utc AS meetAtUtc,
        mp.expires_at_utc AS expiresAtUtc, mp.created_at_utc AS createdAtUtc
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
  const created = await getMeetingPoint(db, festivalId, groupId, id, userId, nowIso);
  // The row was just written in this same DB; this is only null under a concurrent delete.
  if (!created) throw new Error("meeting point vanished after create");
  return created;
}

/**
 * One meeting point (any status) for a squad, with the FULL convergence roster (#26.3): every squad
 * member with their status (going / arrived / not_going / synthesized "no_response"), a live walk ETA
 * for those still heading over who are sharing presence, and the creator-drift smart prompt. Returns
 * null when the point isn't this group's. ETAs are DERIVED server-side — no coordinate ever leaves.
 */
export async function getMeetingPoint(
  db: D1Database,
  festivalId: string,
  groupId: string,
  mpId: string,
  meId: string,
  nowIso: string
): Promise<MeetingPointDto | null> {
  const row = await db
    .prepare(`${SELECT_POINT} WHERE mp.id = ? AND mp.group_id = ?`)
    .bind(mpId, groupId)
    .first<MeetingPointRow>();
  if (!row) return null;
  const [responders, squad, fixes, ctx] = await Promise.all([
    loadMembers(db, [mpId]),
    listMembers(db, groupId, meId),
    getGroupRawFixes(db, groupId, nowIso),
    venueLabelContext(db, festivalId),
  ]);
  const byUser = new Map((responders.get(mpId) ?? []).map((r) => [r.userId, r]));
  const point = { lat: row.lat, lng: row.lng };

  const roster: MeetingPointMemberDto[] = squad.map((gm) => {
    const responded = byUser.get(gm.userId);
    const status = (responded?.status ?? "no_response") as MeetingPointMemberDto["status"];
    // ETA only for members still heading over who are sharing a fresh fix (arrived members are there).
    let etaMinutes: number | null = null;
    let distanceMeters: number | null = null;
    if (status !== "arrived" && status !== "not_going") {
      const fix = fixes.get(gm.userId);
      if (fix && fix.fresh) {
        distanceMeters = Math.round(metersBetween(fix, point));
        etaMinutes = walkEtaMinutes(distanceMeters);
      }
    }
    return {
      userId: gm.userId,
      displayName: gm.displayName,
      avatarColor: gm.avatarColor,
      isYou: gm.isYou,
      status,
      updatedAtUtc: responded?.updatedAt ?? row.createdAtUtc,
      etaMinutes,
      distanceMeters,
    };
  });

  const creatorFix = fixes.get(row.createdByUserId);
  const creatorDistance = creatorFix && creatorFix.fresh ? metersBetween(creatorFix, point) : null;
  return assembleDto(row, roster, ctx, meId, Date.parse(nowIso), creatorDrifted(creatorDistance));
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
        WHERE mp.group_id = ? AND mp.is_safety = 0 AND mp.status NOT IN ('archived', 'cancelled')
          AND mp.expires_at_utc > ?
        ORDER BY mp.created_at_utc DESC`
    )
    .bind(groupId, nowIso)
    .all<MeetingPointRow>();
  if (rows.length === 0) return [];
  const [membersById, ctx] = await Promise.all([
    loadMembers(db, rows.map((r) => r.id)),
    venueLabelContext(db, festivalId),
  ]);
  const nowMs = Date.parse(nowIso);
  // The list cards need counts + lifecycle, not the full roster/ETA — keep it lean (responders only).
  return rows.map((r) =>
    assembleDto(r, (membersById.get(r.id) ?? []).map((m) => memberDto(m, meId)), ctx, meId, nowMs)
  );
}

/**
 * Set the caller's own status on a point (going / arrived / not_going — the going/here/can't loop,
 * #26.3). Upserts the member row; refuses a point that isn't this squad's or is no longer live
 * (cancelled / expired). Returns the refreshed detail so the caller re-renders the convergence view.
 */
export async function setMyMeetingStatus(
  db: D1Database,
  festivalId: string,
  groupId: string,
  mpId: string,
  userId: string,
  status: "going" | "arrived" | "not_going",
  nowIso: string
): Promise<MeetingPointDto | null> {
  const row = await db
    .prepare(`SELECT status, expires_at_utc AS expiresAt FROM meeting_point WHERE id = ? AND group_id = ?`)
    .bind(mpId, groupId)
    .first<{ status: string; expiresAt: string }>();
  if (!row) return null;
  if (row.status !== "active" || Date.parse(row.expiresAt) <= Date.parse(nowIso)) return null; // not live
  await db
    .prepare(
      `INSERT INTO meeting_point_member (meeting_point_id, user_id, status, updated_at_utc)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (meeting_point_id, user_id) DO UPDATE SET status = excluded.status, updated_at_utc = excluded.updated_at_utc`
    )
    .bind(mpId, userId, status, nowIso)
    .run();
  return getMeetingPoint(db, festivalId, groupId, mpId, userId, nowIso);
}

/**
 * End a point (creator-only — enforced by the route): "close" wraps it up cleanly after everyone
 * arrived (#26.4); "cancel" calls it off. Both drop it from the active list and keep the "who went"
 * record until the purge window. Returns the refreshed (now-terminal) detail.
 */
export async function endMeetingPoint(
  db: D1Database,
  festivalId: string,
  groupId: string,
  mpId: string,
  userId: string,
  mode: "cancel" | "close",
  nowIso: string
): Promise<MeetingPointDto | null> {
  const status = mode === "cancel" ? "cancelled" : "archived";
  const res = await db
    .prepare(`UPDATE meeting_point SET status = ? WHERE id = ? AND group_id = ?`)
    .bind(status, mpId, groupId)
    .run();
  if (!res.meta.changes) return null;
  return getMeetingPoint(db, festivalId, groupId, mpId, userId, nowIso);
}

/**
 * Cron hygiene (UC-28, DEC-015): auto-fade active points past their grace window to "archived" (the
 * "who went" record is kept), then purge any archived/cancelled point whose expiry is well behind us
 * — deleting its member rows first. Returns counts. Safety broadcasts (is_safety = 1) are untouched.
 */
export async function purgeExpiredMeetingPoints(
  db: D1Database,
  nowIso: string
): Promise<{ archived: number; purged: number }> {
  const archive = await db
    .prepare(
      `UPDATE meeting_point SET status = 'archived'
        WHERE is_safety = 0 AND status = 'active' AND expires_at_utc <= ?`
    )
    .bind(nowIso)
    .run();

  const purgeBefore = new Date(Date.parse(nowIso) - PURGE_AFTER_EXPIRY_MS).toISOString();
  const { results: stale } = await db
    .prepare(
      `SELECT id FROM meeting_point
        WHERE is_safety = 0 AND status IN ('archived', 'cancelled') AND expires_at_utc <= ?`
    )
    .bind(purgeBefore)
    .all<{ id: string }>();
  if (stale.length > 0) {
    const placeholders = stale.map(() => "?").join(",");
    const ids = stale.map((s) => s.id);
    await db.batch([
      db.prepare(`DELETE FROM meeting_point_member WHERE meeting_point_id IN (${placeholders})`).bind(...ids),
      db.prepare(`DELETE FROM meeting_point WHERE id IN (${placeholders})`).bind(...ids),
    ]);
  }
  return { archived: archive.meta.changes ?? 0, purged: stale.length };
}
