-- Gate 5.3 — "where is everyone?" ping round-trip (UC-25/26, DEC-012/015).
-- A lightweight, squad-scoped request: A asks B to share their whereabouts ('locate', when B's
-- fix is stale) or to turn sharing on ('nudge', when B is ghost). B answers one-tap with their
-- nearest stage — a coarse push_reply that works with GPS off. FCM delivery is the transport
-- (Phase 5+/§19 prereq); the in-app channel (DO fan-out + roster refetch) delivers it today.
CREATE TABLE IF NOT EXISTS presence_ping (
  id              TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL REFERENCES app_group(id),
  from_user_id    TEXT NOT NULL REFERENCES app_user(id),
  to_user_id      TEXT NOT NULL REFERENCES app_user(id),
  kind            TEXT NOT NULL DEFAULT 'locate',  -- 'locate' (where are you) | 'nudge' (turn on sharing)
  created_at_utc  TEXT NOT NULL,
  answered_at_utc TEXT                              -- set when answered or dismissed (no longer pending)
);

-- Inbox lookup: a member's pending pings in a squad, newest first.
CREATE INDEX IF NOT EXISTS idx_presence_ping_inbox
  ON presence_ping(group_id, to_user_id, answered_at_utc);
