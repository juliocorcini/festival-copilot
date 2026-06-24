// FestPilot Worker entry.
//   fetch     -> public read API (Hono) + guarded admin ingest trigger
//   scheduled -> cron-driven lineup ingestion (resolve -> ... -> bump revision)

import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "./env";
import { api } from "./api/routes";
import { upsertFestivalMap, type FestivalMapInput } from "./api/repo";
import { runScheduledIngest } from "./ingest/ingest";
export { GroupRoom } from "./group/room";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ name: "FestPilot API", ok: true }));
app.route("/api", api);

/** Guard admin routes with the ADMIN_TOKEN secret. Returns null when authorized. */
function adminUnauthorized(c: Context<{ Bindings: Env }>): Response | null {
  const token = c.req.header("x-admin-token");
  if (!c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  return null;
}

// Manual ingestion trigger for dev/ops (guarded by ADMIN_TOKEN secret).
app.post("/admin/ingest", async (c) => {
  const denied = adminUnauthorized(c);
  if (denied) return denied;
  const result = await runScheduledIngest(c.env);
  return c.json(result);
});

// Publish/replace a festival's map asset registry (DEC-040). Body = the map publish payload
// (asset slug + static keys + the engine transform doc). Used by the local publish step.
app.post("/admin/festivals/:id/map", async (c) => {
  const denied = adminUnauthorized(c);
  if (denied) return denied;
  const festivalId = c.req.param("id");
  const body = (await c.req.json()) as FestivalMapInput;
  if (!body?.assetSlug || !body?.baseNightKey || !body?.baseDayKey || !body?.transform) {
    return c.json({ error: "invalid map payload" }, 400);
  }
  await upsertFestivalMap(c.env.DB, festivalId, body, new Date().toISOString());
  return c.json({ ok: true, festivalId, revision: body.revision ?? 1 });
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runScheduledIngest(env).then((result) => {
        console.log("[cron] lineup ingest:", JSON.stringify(result));
      })
    );
  },
} satisfies ExportedHandler<Env>;
