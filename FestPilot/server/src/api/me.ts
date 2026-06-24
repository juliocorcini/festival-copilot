// Identity routes (DEC-024/060). Mounted at /api/me.
//   GET  /api/me  -> ensure + return the caller's user (creates an anonymous user on first sight)
//   PUT  /api/me  -> set the profile (display name + optional email + avatar color + locale)
// Country is derived server-side from the edge header `CF-IPCountry` (no GPS) and stored for admin
// metrics (DEC-060/057c); it is never accepted from the client body.

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
    email: readEmail(body.email),
    avatarColor: str(body.avatarColor, 16),
    locale: str(body.locale, 10),
  };
}

/** Light email validation: a single @ with a dotted domain. Invalid/empty → undefined (skip). */
function readEmail(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const email = v.trim().slice(0, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

/** The edge country code (e.g. "BE"); 2 letters, never from the client body. */
function readCountry(req: Request): string | null {
  const cc = req.headers.get("CF-IPCountry");
  return cc && /^[A-Za-z]{2}$/.test(cc) ? cc.toUpperCase() : null;
}

me.get("/", async (c) => {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return c.json({ error: "unauthorized" }, 401);
  const user = await ensureUser(c.env.DB, identity, new Date().toISOString(), undefined, readCountry(c.req.raw));
  return c.json({ user });
});

me.put("/", async (c) => {
  const identity = getUserFromRequest(c.req.raw);
  if (!identity) return c.json({ error: "unauthorized" }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await ensureUser(
    c.env.DB,
    identity,
    new Date().toISOString(),
    readProfile(body),
    readCountry(c.req.raw)
  );
  return c.json({ user });
});
