// Presence intake (Gate 5.1, UC-21/22 — DEC-006/007/015/046). Mounted at /api/presence. A single
// raw fix updates the caller's coarse presence in every squad they share with; the master pause
// flips them invisible everywhere. Raw lat/lng are accepted here and stored SERVER-ONLY — they are
// never returned by any read (see api/presence.ts + the GET /api/groups/:id/presence roster).

import { Hono } from "hono";
import type { Env } from "../env";
import { caller, notifyGroup } from "./groups-routes";
import { recordFix, setSharingForAllGroups, type PresenceFix } from "./presence";
import type { PresenceSource } from "../domain/presence";

export const presence = new Hono<{ Bindings: Env }>();

function finiteNumber(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readSource(v: unknown): PresenceSource {
  return v === "manual" || v === "push_reply" ? v : "gps";
}

// Report a raw fix. Body: { lat, lng, accuracyMeters?, source? }. Fans a "presence" change out to
// every affected squad so members refetch the coarse roster.
presence.post("/", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const lat = finiteNumber(body.lat);
  const lng = finiteNumber(body.lng);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return c.json({ error: "lat and lng are required" }, 400);
  }
  const accuracy = finiteNumber(body.accuracyMeters);
  const fix: PresenceFix = {
    lat,
    lng,
    accuracyMeters: accuracy !== null && accuracy >= 0 ? Math.round(accuracy) : null,
    source: readSource(body.source),
  };
  const affected = await recordFix(c.env.DB, user.id, fix, new Date().toISOString());
  await Promise.all(affected.map((groupId) => notifyGroup(c.env, groupId, "presence")));
  return c.json({ ok: true, groups: affected.length });
});

// Master switch (#25.6): pause sharing everywhere, or resume to coarse ("stage"). Body: { paused }.
presence.post("/pause", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const paused = body.paused === true;
  await setSharingForAllGroups(c.env.DB, user.id, paused ? "ghost" : "stage");
  // Tell each of the caller's squads to refetch (membership read is cheap; correctness via refetch).
  const { results } = await c.env.DB.prepare(`SELECT group_id AS groupId FROM group_member WHERE user_id = ?`)
    .bind(user.id)
    .all<{ groupId: string }>();
  await Promise.all(results.map((r) => notifyGroup(c.env, r.groupId, "presence")));
  return c.json({ ok: true, paused });
});
