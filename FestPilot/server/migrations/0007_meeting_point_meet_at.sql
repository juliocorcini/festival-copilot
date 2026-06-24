-- 0007: Phase 6 (Gate 6.1) — "come to me" meeting point: the optional scheduled meet time.
-- The exact spot / note / expiry / visibility columns already exist (0001_init). meet_at_utc is the
-- "when" (now => NULL; after-this-set / in-30-min / custom => an ISO instant, UTC). The photo is
-- deferred (DEC-047 — R2 is not enabled in V1, DEC-038), so photo_url stays unused for now.
ALTER TABLE meeting_point ADD COLUMN meet_at_utc TEXT;

-- Active-listing index: a squad reads its non-archived, not-yet-expired points by group.
CREATE INDEX IF NOT EXISTS idx_meeting_point_active ON meeting_point(group_id, expires_at_utc);
