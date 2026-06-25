// FestPilot Worker entry.
//   fetch     -> public read API (Hono) + guarded admin ingest trigger
//   scheduled -> cron-driven lineup ingestion (resolve -> ... -> bump revision)

import { Hono } from "hono";
import type { Env } from "./env";
import { api } from "./api/routes";
import { admin } from "./api/admin";
import { ingestAllFestivals } from "./ingest/festivals";
import { purgeExpiredPresence } from "./api/presence";
import { purgeExpiredMeetingPoints } from "./api/meetingPoints";
import { getImage } from "./media/store";
export { GroupRoom } from "./group/room";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ name: "FestPilot API", ok: true }));
app.route("/api", api);

// Admin back-office (R11 / DEC-057): one guarded route group (x-admin-token). See api/admin.ts.
app.route("/admin", admin);

// Serve media straight from R2 (DEC-059): avatars + meeting photos. No auth — the key is opaque and
// the object is public-by-URL; objects are stored `immutable` so the edge/browser cache them for a
// year (avatar keys are versioned, so a new photo is a new URL — no stale cache).
app.get("/media/*", async (c) => {
  const key = c.req.path.slice("/media/".length);
  if (!key) return c.notFound();
  const obj = await getImage(c.env, key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(obj.body, { headers });
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      ingestAllFestivals(env).then((results) => {
        console.log("[cron] lineup ingest:", JSON.stringify({ festivals: results.length, results }));
      })
    );
    // Presence hygiene (DEC-008/015): drop stale fixes + downgrade lapsed precise shares to coarse.
    const nowIso = new Date().toISOString();
    ctx.waitUntil(
      purgeExpiredPresence(env.DB, nowIso).then((r) => {
        console.log("[cron] presence purge:", JSON.stringify(r));
      })
    );
    // Meeting-point hygiene (UC-28, DEC-015): auto-fade expired points + purge old archived/cancelled.
    ctx.waitUntil(
      purgeExpiredMeetingPoints(env.DB, nowIso).then((r) => {
        console.log("[cron] meeting-point purge:", JSON.stringify(r));
      })
    );
  },
} satisfies ExportedHandler<Env>;
