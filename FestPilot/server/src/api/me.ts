// Identity routes (DEC-024). Mounted at /api/me.
//   GET  /api/me  -> ensure + return the caller's user (creates an anonymous user on first sight)
//   PUT  /api/me  -> set the profile (display name + avatar color + locale)

import { Hono } from "hono";
import type { Env } from "../env";
import { getUserFromRequest } from "../auth";
import { ensureUser, type ProfileInput } from "./users";

export const me = new Hono<{ Bindings: Env }>();

function readProfile(body: Record<string, unknown>): ProfileInput {
  const str = (v: unknown, max: number): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : undefined;
  return {
    displayName: str(body.displayName, 40),
    avatarColor: str(body.avatarColor, 16),
    locale: str(body.locale, 10),
  };
}

me.get("/", async (c) => {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return c.json({ error: "unauthorized" }, 401);
  const user = await ensureUser(c.env.DB, identity, new Date().toISOString());
  return c.json({ user });
});

me.put("/", async (c) => {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await ensureUser(c.env.DB, identity, new Date().toISOString(), readProfile(body));
  return c.json({ user });
});
