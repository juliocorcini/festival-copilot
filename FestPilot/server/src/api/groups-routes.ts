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
  setOverride,
  shareMyPlan,
  unshareMyPlan,
  type SharedSlotInput,
} from "./squadPlan";

export const groups = new Hono<{ Bindings: Env }>();

type Ctx = Context<{ Bindings: Env }>;

/** Ensure + return the calling user, or null when the bearer token is absent/invalid. */
async function caller(c: Ctx): Promise<UserDto | null> {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return null;
  return ensureUser(c.env.DB, identity, new Date().toISOString());
}

/** Best-effort realtime nudge: tell the group's Durable Object to fan out a change. */
async function notifyGroup(env: Env, groupId: string, topic: string): Promise<void> {
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
  await unshareMyPlan(c.env.DB, m.group.id, m.user.id);
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
