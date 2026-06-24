-- Gate 4.3 — shared timetable (Pillar 3a, DEC-013/019).
-- Each member shares their LOCKED plan per group; the squad timetable is auto-built from these
-- (plurality → favorited → owner). Favorites are uploaded only when "use as fallback" is on
-- (#23.8) and stay private otherwise. The DB is the source of truth; the GroupRoom DO only
-- fans out "changed" so clients re-fetch. Owner overrides reuse the existing `group_plan_slot`.

-- A member's shared locked picks (one row per performance). Mirrors plan_slot's partial-set
-- overrides (DEC-018). Re-sharing replaces the member's rows for the day.
CREATE TABLE group_member_plan (
  group_id           TEXT NOT NULL REFERENCES app_group(id),
  user_id            TEXT NOT NULL REFERENCES app_user(id),
  day                TEXT,                       -- festival day label, e.g. "SATURDAY"
  performance_id     TEXT NOT NULL REFERENCES performance(id),
  start_override_utc TEXT,                       -- partial-set cut-in
  end_override_utc   TEXT,                       -- partial-set cut-out ("leave early")
  shared_at_utc      TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id, performance_id)
);
CREATE INDEX idx_group_member_plan_group_day ON group_member_plan(group_id, day);

-- A member's shared favorites, used ONLY as the fallback signal (DEC-019). Keyed by act
-- (matches the local favorites store, which is per-act, not per-performance). No FK to keep it
-- decoupled from the lineup act ids; the client maps act -> performances via the lineup.
CREATE TABLE group_member_favorite (
  group_id  TEXT NOT NULL REFERENCES app_group(id),
  user_id   TEXT NOT NULL REFERENCES app_user(id),
  act_key   TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id, act_key)
);
CREATE INDEX idx_group_member_favorite_group ON group_member_favorite(group_id);

-- Sharing intent on the membership row, so the members list can show "Plan shared" (#23.7)
-- and we know "share favorites" was on even when the member has zero favorites.
ALTER TABLE group_member ADD COLUMN plan_shared_at_utc TEXT;
ALTER TABLE group_member ADD COLUMN share_favorites INTEGER NOT NULL DEFAULT 0;
