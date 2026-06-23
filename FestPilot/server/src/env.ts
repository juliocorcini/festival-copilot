// Cloudflare Worker bindings + vars. Mirrors wrangler.toml.

export interface Env {
  DB: D1Database;
  LINEUP_PAGE_URL: string;
  FESTIVAL_NAME: string;
  FESTIVAL_SLUG: string;
  FESTIVAL_TIMEZONE: string;
  // Secret (wrangler secret put ADMIN_TOKEN). Guards POST /admin/ingest.
  ADMIN_TOKEN?: string;
}
