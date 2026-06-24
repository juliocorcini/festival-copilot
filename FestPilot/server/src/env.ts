// Cloudflare Worker bindings + vars. Mirrors wrangler.toml.

export interface Env {
  DB: D1Database;
  // Per-group realtime fan-out (DEC-037). SQLite-backed Durable Object; see group/room.ts.
  GROUP_ROOM: DurableObjectNamespace;
  // R2 media bucket (DEC-059): avatars + meeting-point photos. The binding is the in-Worker access
  // path; the account token is only for the CLI create/deploy step, never stored in code.
  MEDIA: R2Bucket;
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
