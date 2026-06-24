-- R9.3 (DEC-059): R2-backed media (avatars now; meeting-point photos in R9.5, DEC-047). One row per
-- stored object so the upload route enforces an app-level quota WITHOUT a per-request R2 list — a
-- global object-count ceiling + a total-byte budget, with precise overwrite accounting (avatar keys
-- are versioned, so a replacement deletes the prior row). Cloudflare has no hard spend cap, so these
-- app limits are the real guard-rail. `owner_user_id` ties an avatar to its user for cleanup.
CREATE TABLE IF NOT EXISTS media_object (
  key             TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,              -- 'avatar' | 'meeting'
  owner_user_id   TEXT,
  byte_size       INTEGER NOT NULL,
  content_type    TEXT NOT NULL,
  created_at_utc  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_media_owner ON media_object (owner_user_id);
