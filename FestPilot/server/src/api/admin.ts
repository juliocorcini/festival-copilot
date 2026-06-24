// Admin back-office API (R11 / DEC-057). A single guarded route group: every request must carry the
// `x-admin-token` secret (a proper admin login is a later add). Mounted at /admin by the Worker entry.
// Routes stay thin — they delegate to adminRepo / festivalSuggestions / repo / ingest (guidelines §2.1).

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../env";
import { getAdminOverview } from "./adminRepo";
import { listFestivalSuggestions } from "./festivalSuggestions";
import { upsertFestivalMap, type FestivalMapInput } from "./repo";
import { runScheduledIngest } from "../ingest/ingest";

export const admin = new Hono<{ Bindings: Env }>();

// The admin UI is served from the app origin (a guarded route group); allow the token header cross-origin.
admin.use("*", cors({ origin: "*", allowHeaders: ["x-admin-token", "content-type", "accept"] }));

// Single gate for the whole group: a missing/!match token is rejected before any handler runs.
admin.use("*", async (c, next) => {
  const token = c.req.header("x-admin-token");
  if (!c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
});

// Token probe — the web AdminGate calls this to validate a pasted token (200 = valid, 401 = not).
admin.get("/ping", (c) => c.json({ ok: true }));

// R11.1a — Festivals overview: global KPIs + per-festival health (lineup / timetable / map).
admin.get("/overview", async (c) => {
  const overview = await getAdminOverview(c.env.DB);
  return c.json(overview);
});

// R11.3 — Festival-suggestions inbox (DEC-055): most-requested first.
admin.get("/festival-suggestions", async (c) => {
  const suggestions = await listFestivalSuggestions(c.env.DB);
  return c.json({ suggestions });
});

// Manual lineup ingestion trigger for dev/ops (also the dashboard "Re-import" action, R11.1b).
admin.post("/ingest", async (c) => {
  const result = await runScheduledIngest(c.env);
  return c.json(result);
});

// Publish/replace a festival's map asset registry (DEC-040). Body = the map publish payload
// (asset slug + static keys + the engine transform doc). Used by the local publish step + map editor.
admin.post("/festivals/:id/map", async (c) => {
  const festivalId = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as FestivalMapInput | null;
  if (!body?.assetSlug || !body?.baseNightKey || !body?.baseDayKey || !body?.transform) {
    return c.json({ error: "invalid map payload" }, 400);
  }
  await upsertFestivalMap(c.env.DB, festivalId, body, new Date().toISOString());
  return c.json({ ok: true, festivalId, revision: body.revision ?? 1 });
});
