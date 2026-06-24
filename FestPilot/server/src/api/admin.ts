// Admin back-office API (R11 / DEC-057). A single guarded route group: every request must carry the
// `x-admin-token` secret (a proper admin login is a later add). Mounted at /admin by the Worker entry.
// Routes stay thin — they delegate to adminRepo / festivalSuggestions / repo / ingest (guidelines §2.1).

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../env";
import { getAdminOverview, getLineupDashboard } from "./adminRepo";
import {
  isSuggestionStatus,
  listFestivalSuggestions,
  updateSuggestionStatus,
} from "./festivalSuggestions";
import { upsertFestivalMap, type FestivalMapInput } from "./repo";
import { getDataSource, readDataSourceInput, upsertDataSource } from "./dataSource";
import { getMetrics } from "./metricsRepo";
import {
  getInjectableStages,
  injectStageFix,
  listTestableGroups,
  listTestMembers,
  purgeTestData,
  spawnTestMember,
} from "./testConsole";
import { notifyGroup } from "./groups-routes";
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

// R11.4 — Usage metrics + free-tier runway (DEC-057c): real users + R2 + first-party activity,
// with exact platform figures surfaced honestly as "locked" until a Cloudflare Analytics token is set.
admin.get("/metrics", async (c) => {
  const metrics = await getMetrics(c.env.DB, new Date().toISOString());
  return c.json(metrics);
});

// R11.1b — Lineup & timetable dashboard: documented source + per-stage health for one festival.
admin.get("/festivals/:id/lineup", async (c) => {
  const dashboard = await getLineupDashboard(c.env.DB, c.req.param("id"));
  if (!dashboard) return c.json({ error: "festival not found" }, 404);
  return c.json(dashboard);
});

// R11.2 — Per-festival data-source registry (DEC-057a): where the data comes from + how it's
// captured, with the operational lineup_source surfaced read-only for cross-checking.
admin.get("/festivals/:id/data-source", async (c) => {
  const dto = await getDataSource(c.env.DB, c.req.param("id"));
  return c.json(dto);
});

admin.put("/festivals/:id/data-source", async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const input = readDataSourceInput(body);
  await upsertDataSource(c.env.DB, c.req.param("id"), input, new Date().toISOString());
  const dto = await getDataSource(c.env.DB, c.req.param("id"));
  return c.json(dto);
});

// R11.3 — Festival-suggestions inbox (DEC-055): most-requested first.
admin.get("/festival-suggestions", async (c) => {
  const suggestions = await listFestivalSuggestions(c.env.DB);
  return c.json({ suggestions });
});

// R11.3 — move a suggestion through new → planned → live / declined.
admin.patch("/festival-suggestions/:id", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { status?: unknown } | null;
  if (!isSuggestionStatus(body?.status)) {
    return c.json({ error: "invalid status" }, 400);
  }
  const ok = await updateSuggestionStatus(c.env.DB, c.req.param("id"), body.status, new Date().toISOString());
  if (!ok) return c.json({ error: "suggestion not found" }, 404);
  return c.json({ ok: true, status: body.status });
});

// R11.5 — Live test command console (DEC-057d). Inject synthetic is_test members + drive their
// presence through the real pipeline; refuse non-test users; purge wipes every test entity.
admin.get("/test/groups", async (c) => {
  const groups = await listTestableGroups(c.env.DB);
  return c.json({ groups });
});

admin.get("/test/festivals/:id/stages", async (c) => {
  const stages = await getInjectableStages(c.env.DB, c.req.param("id"));
  return c.json({ stages });
});

admin.get("/test/groups/:id/members", async (c) => {
  const members = await listTestMembers(c.env.DB, c.req.param("id"));
  return c.json({ members });
});

admin.post("/test/groups/:id/members", async (c) => {
  const groupId = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { name?: string; color?: string; stageId?: string };
  const nowIso = new Date().toISOString();
  const member = await spawnTestMember(c.env.DB, groupId, nowIso, body.name, body.color);
  if (!member) return c.json({ error: "group not found" }, 404);
  let injected = false;
  if (typeof body.stageId === "string" && body.stageId) {
    const result = await injectStageFix(c.env.DB, member.userId, groupId, body.stageId, nowIso);
    injected = result.ok;
    if (result.ok) await notifyGroup(c.env, groupId, "presence");
  }
  return c.json({ member, injected }, 201);
});

admin.post("/test/members/:userId/inject", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { groupId?: string; stageId?: string };
  if (!body.groupId || !body.stageId) return c.json({ error: "groupId and stageId are required" }, 400);
  const result = await injectStageFix(c.env.DB, c.req.param("userId"), body.groupId, body.stageId, new Date().toISOString());
  if (!result.ok) return c.json({ error: result.reason ?? "inject failed" }, 400);
  await notifyGroup(c.env, body.groupId, "presence");
  return c.json({ ok: true });
});

admin.post("/test/purge", async (c) => {
  const result = await purgeTestData(c.env.DB);
  return c.json(result);
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
