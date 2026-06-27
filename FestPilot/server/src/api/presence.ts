// Presence store (Pillar 3b, Phase 5 — UC-21/22/24, DEC-007/008/015/046). The DB is the source of
// truth; the GroupRoom DO only fans out "presence changed" so clients refetch. PRIVACY CONTRACT:
//   * raw lat/lng are written to `presence` and NEVER selected into a client DTO (DEC-015);
//   * a raw fix is turned into a coarse label by the pure domain (domain/presence.ts);
//   * sharing is per-squad (group_member.share_location): off=ghost / while_using=stage(coarse) /
//     live_until=precise(60-min, server-hard-expiring);
//   * a fix updates presence only for squads where the member isn't ghost; ghost deletes the row.

import { ulid } from "../db/ids";
import { getFestivalMap, listStages } from "./repo";
import {
  coarsenPresence,
  precisePinOf,
  presenceExpiry,
  type CoarsePresence,
  type PresenceSource,
  type StageCoord,
} from "../domain/presence";
import type {
  CoarsePresenceDto,
  GroupPresenceDto,
  PresenceMemberDto,
  PrecisePresenceDto,
  ShareMode,
} from "./dto";

/** A raw GPS/manual fix coming in. lat/lng are accepted, stored server-only, never echoed back. */
export interface PresenceFix {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  source: PresenceSource;
}

const DB_TO_SHARE_MODE: Record<string, ShareMode> = {
  off: "ghost",
  while_using: "stage",
  live_until: "precise",
};

const SHARE_MODE_TO_DB: Record<ShareMode, string> = {
  ghost: "off",
  stage: "while_using",
  precise: "live_until",
};

/** Default precise window (DEC-039): a precise pin auto-expires after 60 minutes. */
export const PRECISE_DEFAULT_MINUTES = 60;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Georeferenced stage coordinates for a festival, taken from the published map transform (the same
 * source the web map + travel matrix use) and joined to stage ids by name. Empty when no map.
 */
export async function getStageCoords(db: D1Database, festivalId: string): Promise<StageCoord[]> {
  const [map, stages] = await Promise.all([getFestivalMap(db, festivalId), listStages(db, festivalId)]);
  if (!map) return [];
  const idByName = new Map(stages.map((s) => [normalizeName(s.name), s.id]));
  const out: StageCoord[] = [];
  for (const g of map.transform.stages) {
    if (!g.matched) continue;
    const stageId = idByName.get(normalizeName(g.name));
    if (stageId) out.push({ stageId, lat: g.lat, lng: g.lng });
  }
  return out;
}

/** A member's latest raw fix in a squad — SERVER-ONLY (lat/lng never leave this process). */
export interface RawFix {
  lat: number;
  lng: number;
  ageSeconds: number;
  /** Still inside its freshness window (gps ~15 min / manual ~45 min). */
  fresh: boolean;
}

/**
 * Latest raw fixes for a squad, keyed by user id — the SERVER-ONLY input to meeting-point ETAs.
 * Presence rows already store the exact lat/lng (DEC-007/008); this exposes them ONLY inside the
 * Worker so the meeting repo can derive a walk ETA. The lat/lng are never returned to any client.
 */
export async function getGroupRawFixes(
  db: D1Database,
  groupId: string,
  nowIso: string
): Promise<Map<string, RawFix>> {
  const nowMs = Date.parse(nowIso);
  const { results } = await db
    .prepare(
      `SELECT user_id AS userId, lat, lng, updated_at_utc AS updatedAt, expires_at_utc AS expiresAt
         FROM presence WHERE group_id = ?`
    )
    .bind(groupId)
    .all<{ userId: string; lat: number | null; lng: number | null; updatedAt: string | null; expiresAt: string | null }>();
  const out = new Map<string, RawFix>();
  for (const r of results) {
    if (r.lat == null || r.lng == null || !r.updatedAt) continue;
    const updatedMs = Date.parse(r.updatedAt);
    const expiresMs = r.expiresAt ? Date.parse(r.expiresAt) : 0;
    out.set(r.userId, {
      lat: r.lat,
      lng: r.lng,
      ageSeconds: Math.max(0, Math.round((nowMs - updatedMs) / 1000)),
      fresh: expiresMs > nowMs,
    });
  }
  return out;
}

/** The act playing at a stage right now (first-billed), for the "watching X" line. Null when none. */
async function currentArtistAt(
  db: D1Database,
  festivalId: string,
  stageId: string,
  nowIso: string
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT a.id AS id
         FROM performance p
         JOIN performance_artist pa ON pa.performance_id = p.id
         JOIN artist a ON a.id = pa.artist_id
        WHERE p.festival_id = ? AND p.stage_id = ? AND p.active = 1
          AND p.start_at_utc <= ? AND p.end_at_utc >= ?
        ORDER BY pa.sort_order ASC
        LIMIT 1`
    )
    .bind(festivalId, stageId, nowIso, nowIso)
    .first<{ id: string }>();
  return row?.id ?? null;
}

interface MembershipRow {
  groupId: string;
  festivalId: string;
  shareLocation: string;
  shareUntil: string | null;
}

/**
 * Whether a member with this sharing state currently shares presence to their squad. Only ghost
 * ("off") hides; a lapsed precise window still shares coarsely until the cron downgrades it to
 * "while_using", so a precise pin that times out becomes coarse rather than invisible.
 */
function sharesNow(shareLocation: string): boolean {
  return shareLocation !== "off";
}

/**
 * Record one raw fix and refresh the caller's coarse presence in every squad they share with.
 * Returns the affected group ids so the route can fan out a "presence" change to each. Ghost squads
 * have their row removed (so the member disappears). Raw lat/lng are stored but never returned.
 */
export async function recordFix(
  db: D1Database,
  userId: string,
  fix: PresenceFix,
  nowIso: string
): Promise<string[]> {
  const nowMs = Date.parse(nowIso);
  const { results: memberships } = await db
    .prepare(
      `SELECT m.group_id AS groupId, g.festival_id AS festivalId,
              m.share_location AS shareLocation, m.share_until_utc AS shareUntil
         FROM group_member m
         JOIN app_group g ON g.id = m.group_id
        WHERE m.user_id = ?`
    )
    .bind(userId)
    .all<MembershipRow>();
  if (memberships.length === 0) return [];

  // Coarsen once per distinct festival (all squads usually share one festival).
  const coarseByFestival = new Map<string, CoarsePresence>();
  const artistByFestival = new Map<string, string | null>();
  for (const fest of new Set(memberships.map((m) => m.festivalId))) {
    const stages = await getStageCoords(db, fest);
    const coarse = coarsenPresence({ lat: fix.lat, lng: fix.lng }, stages, fix.accuracyMeters);
    coarseByFestival.set(fest, coarse);
    artistByFestival.set(
      fest,
      coarse.stageId ? await currentArtistAt(db, fest, coarse.stageId, nowIso) : null
    );
  }

  const expiresIso = new Date(presenceExpiry(fix.source, nowMs)).toISOString();
  const statements: D1PreparedStatement[] = [];
  const affected: string[] = [];

  for (const m of memberships) {
    affected.push(m.groupId);
    if (!sharesNow(m.shareLocation)) {
      statements.push(
        db.prepare(`DELETE FROM presence WHERE group_id = ? AND user_id = ?`).bind(m.groupId, userId)
      );
      continue;
    }
    const coarse = coarseByFestival.get(m.festivalId)!;
    const artistId = artistByFestival.get(m.festivalId) ?? null;
    statements.push(
      db
        .prepare(
          `INSERT INTO presence
             (id, group_id, user_id, stage_id, current_artist_id, coarse_label, between_stage_id,
              lat, lng, accuracy_meters, confidence, source, updated_at_utc, expires_at_utc)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(group_id, user_id) DO UPDATE SET
             stage_id          = excluded.stage_id,
             current_artist_id = excluded.current_artist_id,
             coarse_label      = excluded.coarse_label,
             between_stage_id  = excluded.between_stage_id,
             lat               = excluded.lat,
             lng               = excluded.lng,
             accuracy_meters   = excluded.accuracy_meters,
             confidence        = excluded.confidence,
             source            = excluded.source,
             updated_at_utc    = excluded.updated_at_utc,
             expires_at_utc    = excluded.expires_at_utc`
        )
        .bind(
          ulid(),
          m.groupId,
          userId,
          coarse.stageId,
          artistId,
          coarse.coarseLabel,
          coarse.betweenStageId,
          fix.lat,
          fix.lng,
          fix.accuracyMeters,
          coarse.confidence,
          fix.source,
          nowIso,
          expiresIso
        )
    );
  }

  if (statements.length > 0) await db.batch(statements);
  return affected;
}

/**
 * Answer a "where are you?" ping by declaring a stage (push-reply — works with GPS off, DEC-012).
 * Un-ghosts this squad if needed so the reply is visible, resolves the stage's georeferenced coords,
 * and records a coarse push_reply fix (resolves to "at <stage>"). Returns false if the stage is
 * unknown for the squad's festival. Like every fix, raw coords are stored server-only.
 */
export async function recordStageReply(
  db: D1Database,
  userId: string,
  groupId: string,
  stageId: string,
  nowIso: string
): Promise<boolean> {
  await db
    .prepare(
      `UPDATE group_member SET share_location = 'while_using', share_until_utc = NULL
        WHERE group_id = ? AND user_id = ? AND share_location = 'off'`
    )
    .bind(groupId, userId)
    .run();
  const g = await db.prepare(`SELECT festival_id AS festivalId FROM app_group WHERE id = ?`).bind(groupId).first<{
    festivalId: string;
  }>();
  if (!g) return false;
  const coord = (await getStageCoords(db, g.festivalId)).find((s) => s.stageId === stageId);
  if (!coord) return false;
  await recordFix(db, userId, { lat: coord.lat, lng: coord.lng, accuracyMeters: null, source: "push_reply" }, nowIso);
  return true;
}

interface PresenceRosterRow {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string;
  isTest: number;
  shareLocation: string;
  shareUntil: string | null;
  coarseLabel: string | null;
  confidence: string | null;
  source: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  stageName: string | null;
  betweenStageName: string | null;
  currentArtistName: string | null;
}

function shareModeOf(shareLocation: string): ShareMode {
  return DB_TO_SHARE_MODE[shareLocation] ?? "stage";
}

/** Build a member's coarse presence DTO, or null when nothing should be shown (ghost / no fix). */
function toPresenceDto(row: PresenceRosterRow, nowMs: number): CoarsePresenceDto | null {
  if (shareModeOf(row.shareLocation) === "ghost") return null;
  if (!row.updatedAt || !row.coarseLabel) return null;
  const updatedMs = Date.parse(row.updatedAt);
  const expiresMs = row.expiresAt ? Date.parse(row.expiresAt) : 0;
  return {
    coarseLabel: row.coarseLabel as CoarsePresenceDto["coarseLabel"],
    stageName: row.stageName,
    betweenStageName: row.betweenStageName,
    currentArtistName: row.currentArtistName,
    confidence: (row.confidence as CoarsePresenceDto["confidence"]) ?? "low",
    source: (row.source as CoarsePresenceDto["source"]) ?? "gps",
    updatedAtUtc: row.updatedAt,
    stale: expiresMs <= nowMs,
    ageSeconds: Math.max(0, Math.round((nowMs - updatedMs) / 1000)),
  };
}

function liveStateOf(
  shareLocation: string,
  shareUntil: string | null,
  nowMs: number
): { live: boolean; liveSecondsLeft: number | null } {
  if (shareLocation !== "live_until" || !shareUntil) return { live: false, liveSecondsLeft: null };
  const left = Math.round((Date.parse(shareUntil) - nowMs) / 1000);
  return left > 0 ? { live: true, liveSecondsLeft: left } : { live: false, liveSecondsLeft: null };
}

/**
 * The "where is everyone" roster for one squad. The coarse list NEVER carries lat/lng; the only
 * coordinates that leave the server are the separate `precise[]` pins, populated solely for
 * precise+live members with a fresh fix (DEC-099). Members who are ghost or have no fresh fix come
 * back with `presence: null` (the client renders "ghost" / "last seen").
 */
export async function getGroupPresence(
  db: D1Database,
  groupId: string,
  meId: string,
  nowIso: string
): Promise<GroupPresenceDto> {
  const nowMs = Date.parse(nowIso);
  const { results } = await db
    .prepare(
      `SELECT u.id AS userId, u.display_name AS displayName, u.avatar_color AS avatarColor,
              u.is_test AS isTest,
              m.role AS role, m.share_location AS shareLocation, m.share_until_utc AS shareUntil,
              p.coarse_label AS coarseLabel, p.confidence AS confidence, p.source AS source,
              p.updated_at_utc AS updatedAt, p.expires_at_utc AS expiresAt,
              p.lat AS lat, p.lng AS lng, p.accuracy_meters AS accuracyMeters,
              s.name AS stageName, b.name AS betweenStageName, a.name AS currentArtistName
         FROM group_member m
         JOIN app_user u ON u.id = m.user_id
         LEFT JOIN presence p ON p.group_id = m.group_id AND p.user_id = m.user_id
         LEFT JOIN stage s ON s.id = p.stage_id
         LEFT JOIN stage b ON b.id = p.between_stage_id
         LEFT JOIN artist a ON a.id = p.current_artist_id
        WHERE m.group_id = ?
        ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, m.joined_at_utc ASC`
    )
    .bind(groupId)
    .all<PresenceRosterRow>();

  let liveCount = 0;
  const precise: PrecisePresenceDto[] = [];
  const members: PresenceMemberDto[] = results.map((row) => {
    const { live, liveSecondsLeft } = liveStateOf(row.shareLocation, row.shareUntil, nowMs);
    const presence = toPresenceDto(row, nowMs);
    if (presence && !presence.stale) liveCount += 1;
    // Exact pin only for precise+live members with a fresh fix (DEC-099) — a separate channel from
    // the coarse DTO, so coordinates never ride the default privacy-cheap roster row.
    const pin = precisePinOf(
      {
        userId: row.userId,
        shareLocation: row.shareLocation,
        shareUntil: row.shareUntil,
        lat: row.lat,
        lng: row.lng,
        accuracyMeters: row.accuracyMeters,
        updatedAt: row.updatedAt,
        fixExpiresAt: row.expiresAt,
      },
      nowMs
    );
    if (pin) precise.push(pin);
    return {
      userId: row.userId,
      displayName: row.displayName,
      avatarColor: row.avatarColor,
      role: row.role,
      isYou: row.userId === meId,
      isTest: row.isTest === 1,
      shareMode: shareModeOf(row.shareLocation),
      live,
      liveSecondsLeft,
      presence,
    };
  });

  const mine = members.find((m) => m.isYou);
  return {
    groupId,
    memberCount: members.length,
    liveCount,
    members,
    precise,
    me: {
      shareMode: mine?.shareMode ?? "stage",
      live: mine?.live ?? false,
      liveSecondsLeft: mine?.liveSecondsLeft ?? null,
    },
    inbox: [],
  };
}

/**
 * Set the caller's sharing mode for one squad (the sharing-mode picker #25.3 + ghost toggle).
 * Ghost removes any existing presence row immediately. Precise sets a server-side hard expiry.
 */
export async function setGroupShareMode(
  db: D1Database,
  groupId: string,
  userId: string,
  mode: ShareMode,
  durationMinutes: number,
  nowIso: string
): Promise<void> {
  const dbMode = SHARE_MODE_TO_DB[mode];
  const until =
    mode === "precise"
      ? new Date(Date.parse(nowIso) + Math.max(1, durationMinutes) * 60_000).toISOString()
      : null;
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE group_member SET share_location = ?, share_until_utc = ? WHERE group_id = ? AND user_id = ?`)
      .bind(dbMode, until, groupId, userId),
  ];
  if (mode === "ghost") {
    statements.push(
      db.prepare(`DELETE FROM presence WHERE group_id = ? AND user_id = ?`).bind(groupId, userId)
    );
  }
  await db.batch(statements);
}

/**
 * Master switch (#25.6): pause sharing across ALL the caller's squads, or resume them to coarse
 * ("stage"). Pausing clears every presence row so the member disappears everywhere at once.
 */
export async function setSharingForAllGroups(
  db: D1Database,
  userId: string,
  mode: Extract<ShareMode, "stage" | "ghost">
): Promise<void> {
  const dbMode = SHARE_MODE_TO_DB[mode];
  const statements: D1PreparedStatement[] = [
    db
      .prepare(`UPDATE group_member SET share_location = ?, share_until_utc = NULL WHERE user_id = ?`)
      .bind(dbMode, userId),
  ];
  if (mode === "ghost") {
    statements.push(db.prepare(`DELETE FROM presence WHERE user_id = ?`).bind(userId));
  }
  await db.batch(statements);
}

/**
 * Cron hygiene (DEC-008/015): drop presence rows past their freshness window and downgrade any
 * precise share whose 60-min window lapsed back to coarse ("while_using"). Returns counts.
 */
export async function purgeExpiredPresence(
  db: D1Database,
  nowIso: string
): Promise<{ purged: number; downgraded: number }> {
  const purge = await db.prepare(`DELETE FROM presence WHERE expires_at_utc <= ?`).bind(nowIso).run();
  const downgrade = await db
    .prepare(
      `UPDATE group_member SET share_location = 'while_using', share_until_utc = NULL
        WHERE share_location = 'live_until' AND share_until_utc IS NOT NULL AND share_until_utc <= ?`
    )
    .bind(nowIso)
    .run();
  return {
    purged: Number(purge.meta?.changes ?? 0),
    downgraded: Number(downgrade.meta?.changes ?? 0),
  };
}
