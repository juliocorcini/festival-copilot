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
import {
  festivalSlugExists,
  getIngestTarget,
  ingestAllFestivals,
  ingestFestival,
  onboardFestival,
  readMetaPatch,
  readOnboardInput,
  updateFestivalMeta,
} from "../ingest/festivals";

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

// R11.1c — Add a festival (DEC-063): register its official lineup page + run the parametric
// ingest. No new scraper, no hardcoded lineup — a new festival is imported exactly like the seed.
admin.post("/festivals", async (c) => {
  const parsed = readOnboardInput(await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);

  if (await festivalSlugExists(c.env.DB, parsed.value.slug)) {
    return c.json({ error: `a festival with slug "${parsed.value.slug}" already exists` }, 409);
  }

  const result = await onboardFestival(c.env, parsed.value);
  if (result.status === "error") {
    // Honest failure (DEC-063): we couldn't resolve a lineup from that page — nothing is fabricated.
    return c.json({ error: `could not import a lineup from that page: ${result.error ?? "unknown error"}` }, 502);
  }
  return c.json({ ...result, slug: parsed.value.slug, name: parsed.value.name }, 201);
});

// R11.1c — Edit festival metadata (rename / fix timezone). Slug stays stable (it's the client key).
admin.patch("/festivals/:id", async (c) => {
  const parsed = readMetaPatch(await c.req.json().catch(() => null));
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  const ok = await updateFestivalMeta(c.env.DB, c.req.param("id"), parsed.value);
  if (!ok) return c.json({ error: "festival not found" }, 404);
  return c.json({ ok: true, ...parsed.value });
});

// R11.1c — Re-import ONE festival now (the per-festival "Re-import" action on the dashboard).
admin.post("/festivals/:id/ingest", async (c) => {
  const target = await getIngestTarget(c.env.DB, c.req.param("id"));
  if (!target) return c.json({ error: "no registered lineup source for this festival" }, 404);
  const result = await ingestFestival(c.env, target);
  return c.json(result);
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

// Manual "re-import everything" trigger for dev/ops — iterates every registered festival (DEC-063).
admin.post("/ingest", async (c) => {
  const results = await ingestAllFestivals(c.env);
  return c.json({ results });
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
