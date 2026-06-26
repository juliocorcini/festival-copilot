-- 0015: Phase 8 (DEC — group_event, roadmap D2/Q5/Q6) — fixed-time squad commitments.
-- A group event is a scheduled "let's do this together" moment (e.g. "photo at the Mainstage,
-- 16:00–16:30"). It is a layer that lives ALONGSIDE the squad plan — it is NEVER fed into the
-- set aggregation (buildSquadPlan) nor any personal lock. The DB is the source of truth; the
-- GroupRoom DO only fans out an "events" change so clients refetch (same plumbing as meeting
-- points). Any member can create it (Q6); the creator OR the squad owner can delete it.
CREATE TABLE group_event (
  id                 TEXT PRIMARY KEY,
  group_id           TEXT NOT NULL REFERENCES app_group(id),
  created_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  title              TEXT NOT NULL,
  note               TEXT,
  stage_id           TEXT,                 -- optional venue stage; the name is derived on read
  starts_at_utc      TEXT NOT NULL,
  ends_at_utc        TEXT NOT NULL,
  created_at_utc     TEXT NOT NULL
);
-- Active-listing index: a squad reads its not-yet-ended events by group, ordered by start.
CREATE INDEX idx_group_event_group ON group_event(group_id, ends_at_utc);

-- A lightweight "✓ seen" acknowledgement (optional V1) so the agenda can show "3 of 5 saw this".
-- Purely additive — it never affects the event's existence or the squad plan.
CREATE TABLE group_event_seen (
  event_id     TEXT NOT NULL REFERENCES group_event(id),
  user_id      TEXT NOT NULL REFERENCES app_user(id),
  seen_at_utc  TEXT NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
