// Cloudflare Worker bindings + vars. Mirrors wrangler.toml.

export interface Env {
  DB: D1Database;
  // Per-group realtime fan-out (DEC-037). SQLite-backed Durable Object; see group/room.ts.
  GROUP_ROOM: DurableObjectNamespace;
  LINEUP_PAGE_URL: string;
  FESTIVAL_NAME: string;
  FESTIVAL_SLUG: string;
  FESTIVAL_TIMEZONE: string;
  // Saved source ref (documented fallback chain) — used only if the page is unreachable.
  // The page is always tried first, so a changed uuid is still detected (DEC-009).
  LINEUP_EVENT?: string;
  LINEUP_UUID?: string;
  // Secret (wrangler secret put ADMIN_TOKEN). Guards POST /admin/* routes.
  ADMIN_TOKEN?: string;
}
