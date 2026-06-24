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
