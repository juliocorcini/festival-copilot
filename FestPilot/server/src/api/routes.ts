// Public read API (lineup spine). Mounted at /api by the Worker entry.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../env";
import { getLineup, listFestivals, listStages } from "./repo";

export const api = new Hono<{ Bindings: Env }>();

// PWA is served from a different origin in dev; allow cross-origin reads.
api.use("*", cors());

api.get("/health", (c) => c.json({ ok: true, service: "festpilot-api" }));

api.get("/festivals", async (c) => {
  const festivals = await listFestivals(c.env.DB);
  return c.json({ festivals });
});

api.get("/festivals/:id/lineup", async (c) => {
  const id = c.req.param("id");
  const weekend = c.req.query("weekend");
  const day = c.req.query("day");
  const lineup = await getLineup(c.env.DB, id, { weekend, day });
  if (!lineup) return c.json({ error: "festival not found" }, 404);
  return c.json(lineup);
});

api.get("/festivals/:id/stages", async (c) => {
  const id = c.req.param("id");
  const stages = await listStages(c.env.DB, id);
  return c.json({ stages });
});
