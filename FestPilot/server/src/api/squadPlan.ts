// Shared-timetable store (Pillar 3a, Gate 4.3 — DEC-013/019). The DB is the source of truth;
// this module only stores each member's shared locked plan (+ favorites for the fallback) and the
// owner's per-block overrides. The actual squad timetable is AGGREGATED ON THE CLIENT against the
// lineup it already holds (web/src/domain/squadPlan.ts), so the aggregation stays pure and
// testable and we avoid re-joining the lineup server-side on every read.

import { ulid } from "../db/ids";
import { diffShareIds, shouldCoalesce } from "../domain/planChange";
import type { SquadMemberShareDto, SquadPlanChangeDto, SquadPlanDataDto } from "./dto";

/** One locked pick a member is sharing (mirrors plan_slot's partial-set overrides, DEC-018). */
export interface SharedSlotInput {
  performanceId: string;
  startOverrideUtc?: string | null;
  endOverrideUtc?: string | null;
}

export interface ShareMyPlanInput {
  day: string;
  slots: SharedSlotInput[];
  shareFavorites: boolean;
  favoriteActKeys: string[];
}

/**
 * Replace the caller's shared plan for one day (and their shared favorites group-wide). Re-sharing
 * is idempotent: it wipes the day's rows and re-inserts. Favorites are stored only when the
 * fallback toggle is on (#23.8); otherwise they are cleared.
 *
 * G4 (live re-share, E07/DEC-095): the day's picks are diffed against what was shared before. Only a
 * real CONTENT change bumps the member's `plan_revision` and records a coalesced history line — so
 * the client's auto re-publish loop and any duplicate call are no-ops (no spam, no churn). The
 * aggregation (`buildSquadPlan`) is untouched: this only records who changed what.
 */
export async function shareMyPlan(
  db: D1Database,
  groupId: string,
  userId: string,
  input: ShareMyPlanInput,
  nowIso: string
): Promise<void> {
  const prevPicks = await db
    .prepare(`SELECT performance_id AS id FROM group_member_plan WHERE group_id = ? AND user_id = ? AND day = ?`)
    .bind(groupId, userId, input.day)
    .all<{ id: string }>();
  const prevIds = prevPicks.results.map((r) => r.id);
  const nextIds = input.slots.map((s) => s.performanceId);
  const diff = diffShareIds(prevIds, nextIds);
  const baseRevision = await currentRevision(db, groupId, userId);
  const revision = diff.changed ? baseRevision + 1 : baseRevision;
  const pickCount = new Set(nextIds).size;

  const statements = [
    db
      .prepare(`DELETE FROM group_member_plan WHERE group_id = ? AND user_id = ? AND day = ?`)
      .bind(groupId, userId, input.day),
    ...input.slots.map((s) =>
      db
        .prepare(
          `INSERT INTO group_member_plan
             (group_id, user_id, day, performance_id, start_override_utc, end_override_utc, shared_at_utc)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          groupId,
          userId,
          input.day,
          s.performanceId,
          s.startOverrideUtc ?? null,
          s.endOverrideUtc ?? null,
          nowIso
        )
    ),
    db.prepare(`DELETE FROM group_member_favorite WHERE group_id = ? AND user_id = ?`).bind(groupId, userId),
    ...(input.shareFavorites
      ? input.favoriteActKeys.map((k) =>
          db
            .prepare(`INSERT INTO group_member_favorite (group_id, user_id, act_key) VALUES (?, ?, ?)`)
            .bind(groupId, userId, k)
        )
      : []),
    db
      .prepare(
        `UPDATE group_member SET plan_shared_at_utc = ?, share_favorites = ?, plan_revision = ? WHERE group_id = ? AND user_id = ?`
      )
      .bind(nowIso, input.shareFavorites ? 1 : 0, revision, groupId, userId),
  ];

  // Record the change only when content actually moved (idempotency gate), coalescing rapid same-day
  // edits into one line so the squad's history reads as "Mara updated her plan", not a flood.
  if (diff.changed) {
    statements.push(
      await planChangeStatement(db, {
        groupId,
        userId,
        day: input.day,
        kind: "share",
        added: diff.added,
        removed: diff.removed,
        pickCount,
        revision,
        nowIso,
      })
    );
  }

  await db.batch(statements);
}

/** Stop sharing: drop the caller's shared plan + favorites for this group (their day rows + all favs). */
export async function unshareMyPlan(db: D1Database, groupId: string, userId: string, nowIso: string): Promise<void> {
  const wasShared = await db
    .prepare(`SELECT plan_shared_at_utc AS sharedAt FROM group_member WHERE group_id = ? AND user_id = ?`)
    .bind(groupId, userId)
    .first<{ sharedAt: string | null }>();
  const revision = (await currentRevision(db, groupId, userId)) + 1;

  const statements = [
    db.prepare(`DELETE FROM group_member_plan WHERE group_id = ? AND user_id = ?`).bind(groupId, userId),
    db.prepare(`DELETE FROM group_member_favorite WHERE group_id = ? AND user_id = ?`).bind(groupId, userId),
    db
      .prepare(
        `UPDATE group_member SET plan_shared_at_utc = NULL, share_favorites = 0, plan_revision = ? WHERE group_id = ? AND user_id = ?`
      )
      .bind(revision, groupId, userId),
  ];
  // Only narrate an unshare that actually undid a share (a no-op unshare leaves no history line).
  if (wasShared?.sharedAt != null) {
    statements.push(
      db
        .prepare(
          `INSERT INTO group_plan_change
             (id, group_id, actor_user_id, day, kind, added_count, removed_count, pick_count, revision, created_at_utc, updated_at_utc)
           VALUES (?, ?, ?, NULL, 'unshare', 0, 0, 0, ?, ?, ?)`
        )
        .bind(ulid(), groupId, userId, revision, nowIso, nowIso)
    );
  }
  await db.batch(statements);
}

/** The member's current shared-plan revision (0 when they have never shared). */
async function currentRevision(db: D1Database, groupId: string, userId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT plan_revision AS rev FROM group_member WHERE group_id = ? AND user_id = ?`)
    .bind(groupId, userId)
    .first<{ rev: number }>();
  return Number(row?.rev ?? 0);
}

interface PlanChangeWrite {
  groupId: string;
  userId: string;
  day: string;
  kind: "share";
  added: number;
  removed: number;
  pickCount: number;
  revision: number;
  nowIso: string;
}

/**
 * Build the write for a 'share' history line: an UPDATE that merges into the member's last same-day
 * line when it is within the coalesce window, otherwise a fresh INSERT. Returns a prepared statement
 * so the caller can run it inside the same batch as the plan write (one atomic transaction).
 */
async function planChangeStatement(db: D1Database, w: PlanChangeWrite): Promise<D1PreparedStatement> {
  const last = await db
    .prepare(
      `SELECT id, created_at_utc AS createdAt FROM group_plan_change
        WHERE group_id = ? AND actor_user_id = ? AND day = ? AND kind = 'share'
        ORDER BY created_at_utc DESC LIMIT 1`
    )
    .bind(w.groupId, w.userId, w.day)
    .first<{ id: string; createdAt: string }>();

  if (last && shouldCoalesce(Date.parse(last.createdAt), Date.parse(w.nowIso))) {
    return db
      .prepare(
        `UPDATE group_plan_change
            SET added_count = added_count + ?, removed_count = removed_count + ?,
                pick_count = ?, revision = ?, updated_at_utc = ?
          WHERE id = ?`
      )
      .bind(w.added, w.removed, w.pickCount, w.revision, w.nowIso, last.id);
  }
  return db
    .prepare(
      `INSERT INTO group_plan_change
         (id, group_id, actor_user_id, day, kind, added_count, removed_count, pick_count, revision, created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, 'share', ?, ?, ?, ?, ?, ?)`
    )
    .bind(ulid(), w.groupId, w.userId, w.day, w.added, w.removed, w.pickCount, w.revision, w.nowIso, w.nowIso);
}

interface MemberRow {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  planSharedAt: string | null;
  shareFavorites: number;
  revision: number;
}

/**
 * Raw squad-plan data for one day: every member (with their locked picks + shared favorites) plus
 * the owner overrides. The client aggregates this into the timetable.
 */
export async function getSquadPlanData(
  db: D1Database,
  groupId: string,
  meId: string,
  day: string
): Promise<SquadPlanDataDto> {
  const [members, picks, favorites, overrides] = await Promise.all([
    db
      .prepare(
        `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_color AS avatarColor,
                m.role AS role, m.plan_shared_at_utc AS planSharedAt, m.share_favorites AS shareFavorites,
                m.plan_revision AS revision
           FROM group_member m
           JOIN app_user u ON u.id = m.user_id
          WHERE m.group_id = ?
          ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, m.joined_at_utc ASC`
      )
      .bind(groupId)
      .all<MemberRow>(),
    db
      .prepare(
        `SELECT user_id AS userId, performance_id AS performanceId
           FROM group_member_plan WHERE group_id = ? AND day = ?`
      )
      .bind(groupId, day)
      .all<{ userId: string; performanceId: string }>(),
    db
      .prepare(`SELECT user_id AS userId, act_key AS actKey FROM group_member_favorite WHERE group_id = ?`)
      .bind(groupId)
      .all<{ userId: string; actKey: string }>(),
    db
      .prepare(
        `SELECT chosen_performance_id AS performanceId FROM group_plan_slot
          WHERE group_id = ? AND day = ? AND method = 'owner' AND chosen_performance_id IS NOT NULL`
      )
      .bind(groupId, day)
      .all<{ performanceId: string }>(),
  ]);

  const picksByUser = new Map<string, string[]>();
  for (const p of picks.results) {
    const list = picksByUser.get(p.userId) ?? [];
    list.push(p.performanceId);
    picksByUser.set(p.userId, list);
  }
  const favsByUser = new Map<string, string[]>();
  for (const f of favorites.results) {
    const list = favsByUser.get(f.userId) ?? [];
    list.push(f.actKey);
    favsByUser.set(f.userId, list);
  }

  const memberDtos: SquadMemberShareDto[] = members.results.map((m) => ({
    userId: m.userId,
    displayName: m.displayName,
    avatarColor: m.avatarColor,
    role: m.role,
    isYou: m.userId === meId,
    shared: m.planSharedAt != null,
    shareFavorites: Number(m.shareFavorites) === 1,
    performanceIds: picksByUser.get(m.userId) ?? [],
    favoriteActKeys: favsByUser.get(m.userId) ?? [],
    revision: Number(m.revision ?? 0),
  }));

  return {
    groupId,
    day,
    memberCount: memberDtos.length,
    sharedCount: memberDtos.filter((m) => m.shared).length,
    members: memberDtos,
    overrides: overrides.results.map((o) => o.performanceId),
  };
}

/** Owner override: pin a performance as the squad pick for its block (method=owner). Idempotent. */
export async function setOverride(
  db: D1Database,
  groupId: string,
  day: string,
  performanceId: string,
  nowIso: string
): Promise<void> {
  await db.batch([
    db
      .prepare(`DELETE FROM group_plan_slot WHERE group_id = ? AND day = ? AND time_block = ?`)
      .bind(groupId, day, performanceId),
    db
      .prepare(
        `INSERT INTO group_plan_slot
           (id, group_id, day, time_block, chosen_performance_id, method, updated_at_utc)
         VALUES (?, ?, ?, ?, ?, 'owner', ?)`
      )
      .bind(ulid(), groupId, day, performanceId, performanceId, nowIso),
  ]);
}

/** Revert an owner override back to the auto pick. */
export async function clearOverride(
  db: D1Database,
  groupId: string,
  day: string,
  performanceId: string
): Promise<void> {
  await db
    .prepare(`DELETE FROM group_plan_slot WHERE group_id = ? AND day = ? AND time_block = ?`)
    .bind(groupId, day, performanceId)
    .run();
}

interface PlanChangeRow {
  id: string;
  actorUserId: string;
  actorName: string | null;
  actorColor: string | null;
  day: string | null;
  kind: string;
  addedCount: number;
  removedCount: number;
  pickCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

/**
 * The squad's plan-change history, newest first (G4, E07 — DEC-095). Structured rows only; the
 * client narrates each line via i18n. `isMine` lets the UI mute the caller's own changes in the
 * "what changed" notice (you don't need to be told about your own edit).
 */
export async function listPlanChanges(
  db: D1Database,
  groupId: string,
  meId: string,
  limit: number
): Promise<SquadPlanChangeDto[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id AS id, c.actor_user_id AS actorUserId, u.display_name AS actorName,
              u.avatar_color AS actorColor, c.day AS day, c.kind AS kind,
              c.added_count AS addedCount, c.removed_count AS removedCount, c.pick_count AS pickCount,
              c.created_at_utc AS createdAtUtc, c.updated_at_utc AS updatedAtUtc
         FROM group_plan_change c
         JOIN app_user u ON u.id = c.actor_user_id
        WHERE c.group_id = ?
        ORDER BY c.updated_at_utc DESC
        LIMIT ?`
    )
    .bind(groupId, limit)
    .all<PlanChangeRow>();
  return results.map((r) => ({
    id: r.id,
    actorUserId: r.actorUserId,
    actorName: r.actorName,
    actorColor: r.actorColor,
    isMine: r.actorUserId === meId,
    day: r.day,
    kind: r.kind === "unshare" ? "unshare" : "share",
    addedCount: Number(r.addedCount ?? 0),
    removedCount: Number(r.removedCount ?? 0),
    pickCount: Number(r.pickCount ?? 0),
    createdAtUtc: r.createdAtUtc,
    updatedAtUtc: r.updatedAtUtc,
  }));
}
