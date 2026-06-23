// FestPilot Worker entry.
//   fetch     -> public read API (Hono) + guarded admin ingest trigger
//   scheduled -> cron-driven lineup ingestion (resolve -> ... -> bump revision)

import { Hono } from "hono";
import type { Env } from "./env";
import { api } from "./api/routes";
import { runScheduledIngest } from "./ingest/ingest";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ name: "FestPilot API", ok: true }));
app.route("/api", api);

// Manual ingestion trigger for dev/ops (guarded by ADMIN_TOKEN secret).
app.post("/admin/ingest", async (c) => {
  const token = c.req.header("x-admin-token");
  if (!c.env.ADMIN_TOKEN || token !== c.env.ADMIN_TOKEN) {
    return c.json({ error: "unauthorized" }, 401);
  }
  const result = await runScheduledIngest(c.env);
  return c.json(result);
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
