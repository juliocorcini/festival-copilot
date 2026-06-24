// "Where is everyone?" ping round-trip (Gate 5.3 — UC-25/26, DEC-012/015). A squad-scoped, honest
// request: A asks B to share ('locate', when B is stale) or to turn sharing on ('nudge', when B is
// ghost). B answers one-tap with a stage — a coarse push_reply that works with GPS off (see
// presence.recordStageReply). The DB is the source of truth; the DO only fans out "ping"/"presence"
// so clients refetch. FCM is the eventual push transport (§19 prereq); the in-app channel ships now.

import { ulid } from "../db/ids";
import { recordStageReply } from "./presence";
import type { PingKind } from "../domain/presence";
import type { PingDto } from "./dto";

/** Don't let a pending ping be re-sent in a tight loop; collapse repeats within this window. */
const PING_DEDUPE_MINUTES = 5;
/** A pending ping older than this is no longer surfaced (the asker has moved on). */
const PING_TTL_MINUTES = 30;

/**
 * Send a ping from one member to another in a squad. Idempotent within a short window: an existing
 * unanswered, fresh ping of the same kind is reused rather than duplicated. Returns the ping id.
 */
export async function sendPing(
  db: D1Database,
  groupId: string,
  fromUserId: string,
  toUserId: string,
  kind: PingKind,
  nowIso: string
): Promise<string> {
  const sinceIso = new Date(Date.parse(nowIso) - PING_DEDUPE_MINUTES * 60_000).toISOString();
  const existing = await db
    .prepare(
      `SELECT id FROM presence_ping
        WHERE group_id = ? AND from_user_id = ? AND to_user_id = ? AND kind = ?
          AND answered_at_utc IS NULL AND created_at_utc >= ?
        LIMIT 1`
    )
    .bind(groupId, fromUserId, toUserId, kind, sinceIso)
    .first<{ id: string }>();
  if (existing) return existing.id;

  const id = ulid();
  await db
    .prepare(
      `INSERT INTO presence_ping (id, group_id, from_user_id, to_user_id, kind, created_at_utc)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, groupId, fromUserId, toUserId, kind, nowIso)
    .run();
  return id;
}

interface PingRow {
  id: string;
  fromUserId: string;
  fromName: string | null;
  kind: string;
  createdAtUtc: string;
}

/** Pending pings addressed to a member in a squad (fresh + unanswered), newest first. */
export async function listInbox(
  db: D1Database,
  groupId: string,
  userId: string,
  nowIso: string
): Promise<PingDto[]> {
  const sinceIso = new Date(Date.parse(nowIso) - PING_TTL_MINUTES * 60_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT pp.id AS id, pp.from_user_id AS fromUserId, u.display_name AS fromName,
              pp.kind AS kind, pp.created_at_utc AS createdAtUtc
         FROM presence_ping pp
         JOIN app_user u ON u.id = pp.from_user_id
        WHERE pp.group_id = ? AND pp.to_user_id = ?
          AND pp.answered_at_utc IS NULL AND pp.created_at_utc >= ?
        ORDER BY pp.created_at_utc DESC`
    )
    .bind(groupId, userId, sinceIso)
    .all<PingRow>();
  return results.map((r) => ({
    id: r.id,
    fromUserId: r.fromUserId,
    fromName: r.fromName,
    kind: r.kind === "nudge" ? "nudge" : "locate",
    createdAtUtc: r.createdAtUtc,
  }));
}

/** Mark a ping pending-no-more (answered or dismissed). Only the addressee can close it. */
async function closePing(db: D1Database, groupId: string, pingId: string, userId: string, nowIso: string): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE presence_ping SET answered_at_utc = ?
        WHERE id = ? AND group_id = ? AND to_user_id = ? AND answered_at_utc IS NULL`
    )
    .bind(nowIso, pingId, groupId, userId)
    .run();
  return Number(res.meta?.changes ?? 0) > 0;
}

/**
 * Answer a ping by declaring a stage (push-reply; works with GPS off). Closes the ping and records
 * a coarse presence at the chosen stage. Returns false if the ping isn't the caller's to answer.
 */
export async function answerPing(
  db: D1Database,
  groupId: string,
  pingId: string,
  userId: string,
  stageId: string,
  nowIso: string
): Promise<boolean> {
  const closed = await closePing(db, groupId, pingId, userId, nowIso);
  if (!closed) return false;
  await recordStageReply(db, userId, groupId, stageId, nowIso);
  return true;
}

/** Dismiss a ping without sharing (close it, share nothing). */
export async function dismissPing(
  db: D1Database,
  groupId: string,
  pingId: string,
  userId: string,
  nowIso: string
): Promise<boolean> {
  return closePing(db, groupId, pingId, userId, nowIso);
}
