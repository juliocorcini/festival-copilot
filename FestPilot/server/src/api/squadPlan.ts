// Shared-timetable store (Pillar 3a, Gate 4.3 — DEC-013/019). The DB is the source of truth;
// this module only stores each member's shared locked plan (+ favorites for the fallback) and the
// owner's per-block overrides. The actual squad timetable is AGGREGATED ON THE CLIENT against the
// lineup it already holds (web/src/domain/squadPlan.ts), so the aggregation stays pure and
// testable and we avoid re-joining the lineup server-side on every read.

import { ulid } from "../db/ids";
import type { SquadMemberShareDto, SquadPlanDataDto } from "./dto";

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
 * fallback toggle is on (#23.8); otherwise they are cleared. Runs as a single batch.
 */
export async function shareMyPlan(
  db: D1Database,
  groupId: string,
  userId: string,
  input: ShareMyPlanInput,
  nowIso: string
): Promise<void> {
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
        `UPDATE group_member SET plan_shared_at_utc = ?, share_favorites = ? WHERE group_id = ? AND user_id = ?`
      )
      .bind(nowIso, input.shareFavorites ? 1 : 0, groupId, userId),
  ];
  await db.batch(statements);
}

/** Stop sharing: drop the caller's shared plan + favorites for this group (their day rows + all favs). */
export async function unshareMyPlan(db: D1Database, groupId: string, userId: string): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM group_member_plan WHERE group_id = ? AND user_id = ?`).bind(groupId, userId),
    db.prepare(`DELETE FROM group_member_favorite WHERE group_id = ? AND user_id = ?`).bind(groupId, userId),
    db
      .prepare(`UPDATE group_member SET plan_shared_at_utc = NULL, share_favorites = 0 WHERE group_id = ? AND user_id = ?`)
      .bind(groupId, userId),
  ]);
}

interface MemberRow {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  planSharedAt: string | null;
  shareFavorites: number;
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
                m.role AS role, m.plan_shared_at_utc AS planSharedAt, m.share_favorites AS shareFavorites
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
