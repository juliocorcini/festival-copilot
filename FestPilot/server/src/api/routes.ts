// Public read API (lineup spine). Mounted at /api by the Worker entry.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../env";
import { getFestivalMap, getLineup, listFestivals, listStages } from "./repo";
import { listPois } from "./poiRepo";
import { listTravelTimes } from "./travelTimeRepo";
import { suggestFestival } from "./festivalSuggestions";
import { getUserFromRequest } from "../auth";
import { me } from "./me";
import { media } from "./media";
import { groups } from "./groups-routes";
import { presence } from "./presence-routes";

export const api = new Hono<{ Bindings: Env }>();

// PWA is served from a different origin in dev; allow cross-origin reads + the auth header.
api.use("*", cors({ origin: "*", allowHeaders: ["authorization", "content-type", "accept"] }));

api.get("/health", (c) => c.json({ ok: true, service: "festpilot-api" }));

// Identity (anonymous-first; DEC-024).
api.route("/me", me);

// Media upload (DEC-059): avatar photos to R2. Serving is at GET /media/* (Worker top-level).
api.route("/media", media);

// Groups (Pillar 3a — UC-16/17). Auth-gated; realtime via the GroupRoom Durable Object.
api.route("/groups", groups);

// Live presence intake (Pillar 3b — UC-21/22). Raw fix in; coarse out (raw coords server-only).
api.route("/presence", presence);

api.get("/festivals", async (c) => {
  const festivals = await listFestivals(c.env.DB);
  return c.json({ festivals });
});

// Suggest a festival (DEC-055). Public — no login required. An optional anon identity is recorded
// for frequency analytics; the name is deduped + counted for the admin inbox (R11).
api.post("/festival-suggestions", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return c.json({ error: "name must be 2–80 characters" }, 400);
  }
  const identity = getUserFromRequest(c.req.raw);
  const result = await suggestFestival(
    c.env.DB,
    { name, suggestedBy: identity?.firebaseUid ?? null },
    new Date().toISOString()
  );
  return c.json({ ok: true, count: result.count });
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

// Map asset + affine transform (DEC-030/034/040). The base is a static WebP; this returns
// where it lives + the transform so the client drops the live overlay through the affine.
api.get("/festivals/:id/map", async (c) => {
  const id = c.req.param("id");
  const map = await getFestivalMap(c.env.DB, id);
  if (!map) return c.json({ error: "map not found" }, 404);
  return c.json(map);
});

// Points of interest (DEC-065). Toilets/water/food/medical/exits the client drops on the map
// through the same affine the stages use. Always 200 with a (possibly empty) array — POIs are
// optional decoration, so a festival without any is an honest empty layer, not an error.
api.get("/festivals/:id/pois", async (c) => {
  const pois = await listPois(c.env.DB, c.req.param("id"));
  return c.json({ pois });
});

// Operator-curated stage-to-stage walking minutes (DEC-065). The router prefers a stored pair
// over the live coord estimate (DEC-011); an empty array means "fall back to the estimate".
api.get("/festivals/:id/travel-times", async (c) => {
  const times = await listTravelTimes(c.env.DB, c.req.param("id"));
  return c.json({ times });
});
