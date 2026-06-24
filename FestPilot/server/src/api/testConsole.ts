// R11.5 (DEC-057d): live test command console. Inject SYNTHETIC members (is_test=1) into a real
// squad and drive their presence through the REAL pipeline (recordFix + GroupRoom fan-out), so the
// operator can watch presence/map/squad update live on their own client — without any mock data in
// the app. GUARD-RAILS: every entry point is admin-token gated; fixes are refused for non-test
// users (a real member can never be moved); a purge wipes all test entities. Test users are excluded
// from real usage metrics (metricsRepo filters is_test=0).

import { ulid } from "../db/ids";
import { getStageCoords, recordFix } from "./presence";
import { listStages } from "./repo";

const TEST_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elif", "Felipe", "Gina", "Hugo"];
const TEST_COLORS = ["#7C3AED", "#2563EB", "#059669", "#DB2777", "#D97706", "#0891B2"];

export interface TestGroupRow {
  id: string;
  name: string;
  festivalId: string;
  festivalName: string;
  memberCount: number;
  testCount: number;
  hasMap: boolean;
}

export interface InjectableStage {
  stageId: string;
  name: string;
}

export interface TestMemberRow {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  coarseLabel: string | null;
  stageName: string | null;
  updatedAtUtc: string | null;
}

export interface InjectResult {
  ok: boolean;
  reason?: string;
}

/** Groups the operator can target, with member/test counts and whether the festival has map coords. */
export async function listTestableGroups(db: D1Database): Promise<TestGroupRow[]> {
  const { results } = await db
    .prepare(
      `SELECT g.id AS id, g.name AS name, g.festival_id AS festivalId, f.name AS festivalName,
              COUNT(m.user_id) AS memberCount,
              COALESCE(SUM(CASE WHEN u.is_test = 1 THEN 1 ELSE 0 END), 0) AS testCount,
              EXISTS (SELECT 1 FROM festival_map fm WHERE fm.festival_id = g.festival_id) AS hasMap
         FROM app_group g
         JOIN festival f ON f.id = g.festival_id
         LEFT JOIN group_member m ON m.group_id = g.id
         LEFT JOIN app_user u ON u.id = m.user_id
        GROUP BY g.id
        ORDER BY g.created_at_utc DESC`
    )
    .all<{ id: string; name: string; festivalId: string; festivalName: string; memberCount: number; testCount: number; hasMap: number }>();
  return (results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    festivalId: r.festivalId,
    festivalName: r.festivalName,
    memberCount: Number(r.memberCount),
    testCount: Number(r.testCount),
    hasMap: r.hasMap === 1,
  }));
}

/** Stages with georeferenced coords for a festival — the positions a test member can be dropped at. */
export async function getInjectableStages(db: D1Database, festivalId: string): Promise<InjectableStage[]> {
  const [stages, coords] = await Promise.all([listStages(db, festivalId), getStageCoords(db, festivalId)]);
  const nameById = new Map(stages.map((s) => [s.id, s.name]));
  return coords.map((c) => ({ stageId: c.stageId, name: nameById.get(c.stageId) ?? c.stageId }));
}

export async function isTestUser(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare(`SELECT is_test FROM app_user WHERE id = ?`).bind(userId).first<{ is_test: number }>();
  return row?.is_test === 1;
}

/** Create a synthetic member in a squad (is_test=1, sharing coarse so a fix becomes visible). */
export async function spawnTestMember(
  db: D1Database,
  groupId: string,
  nowIso: string,
  name?: string,
  color?: string
): Promise<{ userId: string; displayName: string; avatarColor: string } | null> {
  const group = await db.prepare(`SELECT id FROM app_group WHERE id = ?`).bind(groupId).first<{ id: string }>();
  if (!group) return null;

  const existing = await db
    .prepare(`SELECT COUNT(*) AS c FROM group_member m JOIN app_user u ON u.id = m.user_id AND u.is_test = 1 WHERE m.group_id = ?`)
    .bind(groupId)
    .first<{ c: number }>();
  const idx = Number(existing?.c ?? 0);
  const displayName = (name?.trim() || `Test ${TEST_NAMES[idx % TEST_NAMES.length]}`).slice(0, 40);
  const avatarColor = color?.trim() || TEST_COLORS[idx % TEST_COLORS.length];
  const userId = ulid();

  await db.batch([
    db
      .prepare(
        `INSERT INTO app_user (id, firebase_uid, auth_provider, is_anonymous, display_name, avatar_color, created_at_utc, is_test)
         VALUES (?, ?, 'test', 0, ?, ?, ?, 1)`
      )
      .bind(userId, `test-${userId}`, displayName, avatarColor, nowIso),
    db
      .prepare(
        `INSERT INTO group_member (group_id, user_id, role, share_location, joined_at_utc)
         VALUES (?, ?, 'member', 'while_using', ?)`
      )
      .bind(groupId, userId, nowIso),
  ]);
  return { userId, displayName, avatarColor };
}

export async function listTestMembers(db: D1Database, groupId: string): Promise<TestMemberRow[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_color AS avatarColor,
              p.coarse_label AS coarseLabel, s.name AS stageName, p.updated_at_utc AS updatedAtUtc
         FROM group_member m
         JOIN app_user u ON u.id = m.user_id AND u.is_test = 1
         LEFT JOIN presence p ON p.group_id = m.group_id AND p.user_id = m.user_id
         LEFT JOIN stage s ON s.id = p.stage_id
        WHERE m.group_id = ?
        ORDER BY m.joined_at_utc ASC`
    )
    .bind(groupId)
    .all<TestMemberRow>();
  return results ?? [];
}

/**
 * Drop a test member at a stage's georeferenced coords (the real recordFix path → coarsened to
 * "at <stage>"). Refuses non-test users so a real member can never be moved. Returns ok=false with a
 * reason when the user isn't a test entity, the group is unknown, or the stage has no map coords.
 */
export async function injectStageFix(
  db: D1Database,
  userId: string,
  groupId: string,
  stageId: string,
  nowIso: string
): Promise<InjectResult> {
  if (!(await isTestUser(db, userId))) return { ok: false, reason: "not a test user" };
  const group = await db.prepare(`SELECT festival_id AS festivalId FROM app_group WHERE id = ?`).bind(groupId).first<{ festivalId: string }>();
  if (!group) return { ok: false, reason: "group not found" };
  const stage = (await getStageCoords(db, group.festivalId)).find((s) => s.stageId === stageId);
  if (!stage) return { ok: false, reason: "stage has no map coords" };
  await recordFix(db, userId, { lat: stage.lat, lng: stage.lng, accuracyMeters: 10, source: "manual" }, nowIso);
  return { ok: true };
}

/** Remove every synthetic test entity (presence, pings, plans, memberships, then the users). */
export async function purgeTestData(db: D1Database): Promise<{ users: number }> {
  const before = await db.prepare(`SELECT COUNT(*) AS c FROM app_user WHERE is_test = 1`).first<{ c: number }>();
  const testIds = `SELECT id FROM app_user WHERE is_test = 1`;
  await db.batch([
    db.prepare(`DELETE FROM presence WHERE user_id IN (${testIds})`),
    db.prepare(`DELETE FROM presence_ping WHERE from_user_id IN (${testIds}) OR to_user_id IN (${testIds})`),
    db.prepare(`DELETE FROM group_member_favorite WHERE user_id IN (${testIds})`),
    db.prepare(`DELETE FROM group_member_plan WHERE user_id IN (${testIds})`),
    db.prepare(`DELETE FROM meeting_point_member WHERE user_id IN (${testIds})`),
    db.prepare(`DELETE FROM group_member WHERE user_id IN (${testIds})`),
    db.prepare(`DELETE FROM app_user WHERE is_test = 1`),
  ]);
  return { users: Number(before?.c ?? 0) };
}
