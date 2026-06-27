// Group routes (Pillar 3a — UC-16/17). Mounted at /api/groups. Every route is authenticated
// through the same seam as /api/me (anonymous-first; DEC-024/042) — the caller is ensured into
// an `app_user` before any group operation, so membership rows always reference a real user.

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../env";
import { getUserFromRequest, parseAuthIdentity } from "../auth";
import { ensureUser } from "./users";
import type { UserDto } from "./dto";
import {
  createGroup,
  getGroupForUser,
  invitePreview,
  joinByToken,
  leaveGroup,
  listMembers,
  listMyGroups,
} from "./groups";
import {
  clearOverride,
  getSquadPlanData,
  listPlanChanges,
  setOverride,
  shareMyPlan,
  unshareMyPlan,
  type SharedSlotInput,
} from "./squadPlan";
import { editNote, listNotes, MAX_NOTE_LENGTH, postNote, removeNote, setPinned } from "./board";
import { getGroupPresence, PRECISE_DEFAULT_MINUTES, setGroupShareMode } from "./presence";
import { answerPing, dismissPing, listInbox, sendPing } from "./pings";
import {
  createMeetingPoint,
  endMeetingPoint,
  getMeetingPoint,
  isSettableStatus,
  listActiveSafetyPoints,
  listMeetingPoints,
  setMyMeetingStatus,
} from "./meetingPoints";
import {
  createGroupEvent,
  deleteGroupEvent,
  getGroupEvent,
  listGroupEvents,
  markEventSeen,
} from "./groupEvents";
import type { PingKind } from "../domain/presence";

export const groups = new Hono<{ Bindings: Env }>();

type Ctx = Context<{ Bindings: Env }>;

/** Ensure + return the calling user, or null when the bearer token is absent/invalid. */
export async function caller(c: Ctx): Promise<UserDto | null> {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return null;
  return ensureUser(c.env.DB, identity, new Date().toISOString());
}

/** Best-effort realtime nudge: tell the group's Durable Object to fan out a change. */
export async function notifyGroup(env: Env, groupId: string, topic: string): Promise<void> {
  try {
    const stub = env.GROUP_ROOM.get(env.GROUP_ROOM.idFromName(groupId));
    await stub.fetch("https://group-room/notify", {
      method: "POST",
      body: JSON.stringify({ topic }),
    });
  } catch {
    // Realtime is an enhancement; clients also refetch on focus. Never fail a write on this.
  }
}

function readString(v: unknown, max: number): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null;
}

function readStringArray(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim() !== "" && out.length < max) out.push(item.trim().slice(0, 64));
  }
  return out;
}

/** Resolve the calling member of a group, or a typed failure for the route to translate. */
async function member(c: Ctx, groupId: string): Promise<{ user: UserDto; group: NonNullable<Awaited<ReturnType<typeof getGroupForUser>>> } | { status: 401 | 404 }> {
  const user = await caller(c);
  if (!user) return { status: 401 };
  const group = await getGroupForUser(c.env.DB, groupId, user.id);
  if (!group) return { status: 404 };
  return { user, group };
}

// --- Specific routes first (Hono matches in order; keep these before "/:id"). ---

// Squads the caller belongs to (drives the Squad tab: empty vs group-home).
groups.get("/mine", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const list = await listMyGroups(c.env.DB, user.id);
  return c.json({ groups: list });
});

// Create a squad (#23.4). Caller becomes owner; an invite token is minted immediately.
groups.post("/", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = readString(body.name, 60);
  const festivalId = readString(body.festivalId, 64);
  const emoji = readString(body.emoji, 8);
  if (!name || !festivalId) return c.json({ error: "name and festivalId are required" }, 400);
  const group = await createGroup(c.env.DB, user.id, { name, emoji, festivalId }, new Date().toISOString());
  return c.json({ group }, 201);
});

// Resolve an invite link/QR to its group (the pre-join card #23.6). No membership needed.
groups.get("/invite/:token", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const preview = await invitePreview(c.env.DB, c.req.param("token"), user.id);
  if (!preview) return c.json({ error: "invite not found" }, 404);
  return c.json({ invite: preview });
});

// Join by invite token (link + QR). Token is the capability, so no group id needed in the path.
groups.post("/join", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = readString(body.token, 16);
  if (!token) return c.json({ error: "token is required" }, 400);
  const result = await joinByToken(c.env.DB, user.id, token, new Date().toISOString());
  if (!result.ok) {
    return c.json({ error: result.error }, result.error === "not_found" ? 404 : 409);
  }
  await notifyGroup(c.env, result.group.id, "members");
  return c.json({ group: result.group });
});

// --- Parameterized routes. ---

// Group detail + member list (the members / group-home screen #23.7). Members only.
groups.get("/:id", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  const group = await getGroupForUser(c.env.DB, id, user.id);
  if (!group) return c.json({ error: "not found" }, 404);
  const members = await listMembers(c.env.DB, id, user.id);
  return c.json({ group, members });
});

// --- Shared timetable (Gate 4.3, DEC-013/019). All member-gated; owner-gated where noted. ---

// The squad plan's raw data for one day — the client aggregates it (plurality → favorited → owner).
groups.get("/:id/plan", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const day = readString(c.req.query("day"), 32);
  if (!day) return c.json({ error: "day is required" }, 400);
  const data = await getSquadPlanData(c.env.DB, m.group.id, m.user.id, day);
  return c.json({ plan: data });
});

// The squad's plan-change history (G4, E07 — DEC-095): who re-shared, the net effect, coalesced.
// Newest first; the client narrates each line. Registered before "/:id/plan/:perfId"-style paths.
groups.get("/:id/plan/history", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const changes = await listPlanChanges(c.env.DB, m.group.id, m.user.id, 40);
  return c.json({ changes });
});

// Share my locked plan for a day (#23.8). Body: { day, slots, shareFavorites, favoriteActKeys }.
groups.put("/:id/plan", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const day = readString(body.day, 32);
  if (!day) return c.json({ error: "day is required" }, 400);
  const rawSlots = Array.isArray(body.slots) ? (body.slots as Record<string, unknown>[]) : [];
  const slots: SharedSlotInput[] = [];
  for (const s of rawSlots) {
    const performanceId = readString(s.performanceId, 64);
    if (!performanceId) continue;
    slots.push({
      performanceId,
      startOverrideUtc: readString(s.startOverrideUtc, 40),
      endOverrideUtc: readString(s.endOverrideUtc, 40),
    });
  }
  await shareMyPlan(
    c.env.DB,
    m.group.id,
    m.user.id,
    {
      day,
      slots,
      shareFavorites: body.shareFavorites === true,
      favoriteActKeys: readStringArray(body.favoriteActKeys, 500),
    },
    new Date().toISOString()
  );
  await notifyGroup(c.env, m.group.id, "plan");
  return c.json({ ok: true });
});

// Stop sharing my plan for this squad.
groups.delete("/:id/plan", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  await unshareMyPlan(c.env.DB, m.group.id, m.user.id, new Date().toISOString());
  await notifyGroup(c.env, m.group.id, "plan");
  return c.json({ ok: true });
});

// Owner override (#24.4): pin a performance as the squad pick for its block. Owner only.
groups.post("/:id/plan/override", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  if (m.group.role !== "owner") return c.json({ error: "owner only" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const day = readString(body.day, 32);
  const performanceId = readString(body.performanceId, 64);
  if (!day || !performanceId) return c.json({ error: "day and performanceId are required" }, 400);
  await setOverride(c.env.DB, m.group.id, day, performanceId, new Date().toISOString());
  await notifyGroup(c.env, m.group.id, "plan");
  return c.json({ ok: true });
});

// Revert an owner override back to the auto pick. Owner only.
groups.delete("/:id/plan/override", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  if (m.group.role !== "owner") return c.json({ error: "owner only" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const day = readString(body.day, 32);
  const performanceId = readString(body.performanceId, 64);
  if (!day || !performanceId) return c.json({ error: "day and performanceId are required" }, 400);
  await clearOverride(c.env.DB, m.group.id, day, performanceId);
  await notifyGroup(c.env, m.group.id, "plan");
  return c.json({ ok: true });
});

// --- Group board (Gate 4.4, UC-39, DEC-013). Lightweight pinned notes; NOT chat. Member-gated. ---

// The board — pinned notes first, newest-first.
groups.get("/:id/board", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const notes = await listNotes(c.env.DB, m.group.id, m.user.id);
  return c.json({ notes });
});

// Post a note. Body: { body }. Trimmed + capped; empty is rejected.
groups.post("/:id/board", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = readString(body.body, MAX_NOTE_LENGTH);
  if (!text) return c.json({ error: "body is required" }, 400);
  const note = await postNote(c.env.DB, m.group.id, m.user.id, text, new Date().toISOString());
  await notifyGroup(c.env, m.group.id, "board");
  return c.json({ note }, 201);
});

// Edit a note's body (author only) or pin/unpin it (owner only). Body: { body? , pinned? }.
groups.put("/:id/board/:noteId", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const noteId = c.req.param("noteId");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  let changed = false;
  if (typeof body.pinned === "boolean") {
    if (m.group.role !== "owner") return c.json({ error: "owner only" }, 403);
    changed = (await setPinned(c.env.DB, m.group.id, noteId, body.pinned)) || changed;
  }
  if (body.body !== undefined) {
    const text = readString(body.body, MAX_NOTE_LENGTH);
    if (!text) return c.json({ error: "body is required" }, 400);
    changed = (await editNote(c.env.DB, m.group.id, noteId, m.user.id, text, new Date().toISOString())) || changed;
  }
  if (!changed) return c.json({ error: "not found" }, 404);
  await notifyGroup(c.env, m.group.id, "board");
  return c.json({ ok: true });
});

// Remove a note — author removes own; owner removes any.
groups.delete("/:id/board/:noteId", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const ok = await removeNote(c.env.DB, m.group.id, c.req.param("noteId"), m.user.id, m.group.role === "owner");
  if (!ok) return c.json({ error: "not found" }, 404);
  await notifyGroup(c.env, m.group.id, "board");
  return c.json({ ok: true });
});

// --- Live presence (Gate 5.1, UC-22/24 — DEC-007/015/046). Coarse-only; never coordinates. ---

// The squad's "where is everyone" roster for this group (coarse label + freshness + live state),
// plus the caller's pending ping inbox (so one fetch drives both the roster and the answer prompt).
groups.get("/:id/presence", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const now = new Date().toISOString();
  const [presence, inbox] = await Promise.all([
    getGroupPresence(c.env.DB, m.group.id, m.user.id, now),
    listInbox(c.env.DB, m.group.id, m.user.id, now),
  ]);
  return c.json({ presence: { ...presence, inbox } });
});

// Set my sharing mode for this squad (#25.3 + ghost). Body: { mode: stage|precise|ghost, durationMinutes? }.
groups.put("/:id/share", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode;
  if (mode !== "stage" && mode !== "precise" && mode !== "ghost") {
    return c.json({ error: "mode must be stage|precise|ghost" }, 400);
  }
  const duration = typeof body.durationMinutes === "number" ? body.durationMinutes : PRECISE_DEFAULT_MINUTES;
  await setGroupShareMode(c.env.DB, m.group.id, m.user.id, mode, duration, new Date().toISOString());
  await notifyGroup(c.env, m.group.id, "presence");
  return c.json({ ok: true });
});

// "Where is everyone?" — ping a squad-mate to locate ('locate') or to turn sharing on ('nudge').
groups.post("/:id/ping", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const toUserId = readString(body.toUserId, 64);
  if (!toUserId) return c.json({ error: "toUserId is required" }, 400);
  if (toUserId === m.user.id) return c.json({ error: "cannot ping yourself" }, 400);
  const kind: PingKind = body.kind === "nudge" ? "nudge" : "locate";
  const id = await sendPing(c.env.DB, m.group.id, m.user.id, toUserId, kind, new Date().toISOString());
  await notifyGroup(c.env, m.group.id, "ping");
  return c.json({ ok: true, id }, 201);
});

// Answer a ping by declaring a stage (push-reply; works with GPS off). Body: { stageId }.
groups.post("/:id/ping/:pingId/answer", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const stageId = readString(body.stageId, 64);
  if (!stageId) return c.json({ error: "stageId is required" }, 400);
  const ok = await answerPing(c.env.DB, m.group.id, c.req.param("pingId"), m.user.id, stageId, new Date().toISOString());
  if (!ok) return c.json({ error: "not found" }, 404);
  await notifyGroup(c.env, m.group.id, "presence");
  return c.json({ ok: true });
});

// Dismiss a ping without sharing.
groups.post("/:id/ping/:pingId/dismiss", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const ok = await dismissPing(c.env.DB, m.group.id, c.req.param("pingId"), m.user.id, new Date().toISOString());
  if (!ok) return c.json({ error: "not found" }, 404);
  await notifyGroup(c.env, m.group.id, "ping");
  return c.json({ ok: true });
});

// --- Meeting points (Gate 6.1, UC-27 — DEC-014/046/047). "Come to me": an exact opt-in spot the
// squad walks to. Member-gated; the exact coordinate is the creator's explicit share. Photo deferred. ---

// The squad's active meeting points (not archived, not yet expired), newest first.
groups.get("/:id/meeting-points", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const points = await listMeetingPoints(c.env.DB, m.group.festivalId, m.group.id, m.user.id, new Date().toISOString());
  return c.json({ meetingPoints: points });
});

// Drop a meeting point (B4.2). Body: { lat, lng, accuracyMeters?, title?, note?, meetAtUtc?, expiryMinutes? }.
// lat/lng are the creator's exact, intentional share (DEC-046). The creator is marked "going".
groups.post("/:id/meeting-points", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return c.json({ error: "valid lat and lng are required" }, 400);
  }
  const accuracyRaw = Number(body.accuracyMeters);
  const graceRaw = Number(body.graceMinutes);
  const point = await createMeetingPoint(
    c.env.DB,
    m.group.festivalId,
    m.group.id,
    m.user.id,
    {
      lat,
      lng,
      accuracyMeters: Number.isFinite(accuracyRaw) ? Math.round(accuracyRaw) : null,
      title: readString(body.title, 60) ?? "Meeting point",
      note: readString(body.note, 280),
      meetAtUtc: readString(body.meetAtUtc, 40),
      graceMinutes: Number.isFinite(graceRaw) ? graceRaw : null,
      isSafety: body.isSafety === true,
    },
    new Date().toISOString()
  );
  await notifyGroup(c.env, m.group.id, body.isSafety === true ? "safety" : "meeting");
  return c.json({ meetingPoint: point }, 201);
});

// --- Safety / "I'm lost" broadcast (Gate 6.3, #26.5/#26.6 — UC-28, DEC-022). A meeting point flagged
// is_safety: the creator shares their exact spot so the squad converges to help. It lives in its own
// lane (excluded from the regular meeting list), never auto-fades, and ends on "I'm okay" (close). ---

// The squad's active safety broadcasts, each with the converging roster + live ETAs.
groups.get("/:id/safety", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const points = await listActiveSafetyPoints(c.env.DB, m.group.festivalId, m.group.id, m.user.id, new Date().toISOString());
  return c.json({ safetyPoints: points });
});

// One meeting point with the full convergence roster + live ETAs + lifecycle (Gate 6.2, #26.3).
groups.get("/:id/meeting-points/:mpId", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const point = await getMeetingPoint(c.env.DB, m.group.festivalId, m.group.id, c.req.param("mpId"), m.user.id, new Date().toISOString());
  if (!point) return c.json({ error: "not found" }, 404);
  return c.json({ meetingPoint: point });
});

// Set my own status on a point: going / arrived / not_going (the going/here/can't loop, #26.3).
groups.post("/:id/meeting-points/:mpId/status", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = typeof body.status === "string" ? body.status : "";
  if (!isSettableStatus(status)) return c.json({ error: "invalid status" }, 400);
  const point = await setMyMeetingStatus(c.env.DB, m.group.festivalId, m.group.id, c.req.param("mpId"), m.user.id, status, new Date().toISOString());
  if (!point) return c.json({ error: "not active" }, 409);
  await notifyGroup(c.env, m.group.id, "meeting");
  return c.json({ meetingPoint: point });
});

// End a point — creator-only. { mode: "close" | "cancel" } (#26.4 close / cancel).
groups.post("/:id/meeting-points/:mpId/end", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const mpId = c.req.param("mpId");
  const now = new Date().toISOString();
  const existing = await getMeetingPoint(c.env.DB, m.group.festivalId, m.group.id, mpId, m.user.id, now);
  if (!existing) return c.json({ error: "not found" }, 404);
  if (!existing.isMine) return c.json({ error: "only the creator can end this" }, 403);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const mode = body.mode === "cancel" ? "cancel" : "close";
  const point = await endMeetingPoint(c.env.DB, m.group.festivalId, m.group.id, mpId, m.user.id, mode, now);
  if (!point) return c.json({ error: "not found" }, 404);
  await notifyGroup(c.env, m.group.id, "meeting");
  return c.json({ meetingPoint: point });
});

// --- Group events (Phase 8, roadmap D2/Q5/Q6). A fixed-time squad commitment ("photo at 16:00") —
// a layer ALONGSIDE the squad plan, never fed into the set aggregation or any personal lock. Any
// member creates one; the creator OR the squad owner deletes it. Fanned out via the "events" topic. ---

// The squad's upcoming + live events (not-yet-ended), earliest first.
groups.get("/:id/events", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const events = await listGroupEvents(
    c.env.DB,
    m.group.festivalId,
    m.group.id,
    m.user.id,
    m.group.role === "owner",
    new Date().toISOString()
  );
  return c.json({ events });
});

// Create an event (any member, Q6). Body: { title, startsAtUtc, endsAtUtc?, stageId?, note? }.
groups.post("/:id/events", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = readString(body.title, 80);
  const startsAtUtc = readString(body.startsAtUtc, 40);
  if (!title || !startsAtUtc || !Number.isFinite(Date.parse(startsAtUtc))) {
    return c.json({ error: "title and a valid startsAtUtc are required" }, 400);
  }
  const endsRaw = readString(body.endsAtUtc, 40);
  const event = await createGroupEvent(
    c.env.DB,
    m.group.festivalId,
    m.group.id,
    m.user.id,
    {
      title,
      note: readString(body.note, 280),
      stageId: readString(body.stageId, 64),
      startsAtUtc,
      endsAtUtc: endsRaw && Number.isFinite(Date.parse(endsRaw)) ? endsRaw : null,
    },
    new Date().toISOString()
  );
  await notifyGroup(c.env, m.group.id, "events");
  return c.json({ event }, 201);
});

// Tick "✓ seen" on an event (any member — the optional V1 acknowledgement).
groups.post("/:id/events/:eventId/seen", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const event = await markEventSeen(
    c.env.DB,
    m.group.festivalId,
    m.group.id,
    c.req.param("eventId"),
    m.user.id,
    m.group.role === "owner",
    new Date().toISOString()
  );
  if (!event) return c.json({ error: "not found" }, 404);
  await notifyGroup(c.env, m.group.id, "events");
  return c.json({ event });
});

// Delete an event — creator OR squad owner (Q6). 404 if it isn't this group's; 403 if not allowed.
groups.delete("/:id/events/:eventId", async (c) => {
  const m = await member(c, c.req.param("id"));
  if ("status" in m) return c.json({ error: "no" }, m.status);
  const eventId = c.req.param("eventId");
  const isOwner = m.group.role === "owner";
  const existing = await getGroupEvent(c.env.DB, m.group.festivalId, m.group.id, eventId, m.user.id, isOwner, new Date().toISOString());
  if (!existing) return c.json({ error: "not found" }, 404);
  if (!existing.canDelete) return c.json({ error: "only the creator or squad owner can delete this" }, 403);
  await deleteGroupEvent(c.env.DB, m.group.id, eventId, m.user.id, isOwner);
  await notifyGroup(c.env, m.group.id, "events");
  return c.json({ ok: true });
});

// Realtime subscription — forwarded to the group's Durable Object. Members only.
// Browsers can't set an Authorization header on a WebSocket handshake, so the token may also
// arrive as `?t=` (upgrade-only); we still ensure the user and verify membership before forwarding.
groups.get("/:id/socket", async (c) => {
  const identity =
    getUserFromRequest(c.req.raw) ??
    parseAuthIdentity(c.req.query("t") ? `Bearer ${c.req.query("t")}` : null);
  if (!identity) return c.json({ error: "unauthorized" }, 401);
  const user = await ensureUser(c.env.DB, identity, new Date().toISOString());
  const id = c.req.param("id");
  const group = await getGroupForUser(c.env.DB, id, user.id);
  if (!group) return c.json({ error: "forbidden" }, 403);
  const stub = c.env.GROUP_ROOM.get(c.env.GROUP_ROOM.idFromName(id));
  return stub.fetch(new Request("https://group-room/socket", c.req.raw));
});

// Leave a squad (#23.7 "Leave squad").
groups.post("/:id/leave", async (c) => {
  const user = await caller(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const id = c.req.param("id");
  await leaveGroup(c.env.DB, id, user.id);
  await notifyGroup(c.env, id, "members");
  return c.json({ ok: true });
});
