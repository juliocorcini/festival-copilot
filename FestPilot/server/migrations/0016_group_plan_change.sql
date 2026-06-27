-- Gate G4 — live re-share + group plan history (E07, DEC-095). The shared plan stops being a manual
-- one-shot: the client re-publishes a member's locked plan as it changes, and the squad sees a
-- narrated, coalesced history of WHO changed their plan + the net effect. The DB stays the source of
-- truth; the GroupRoom DO still only fans out "plan" so clients refetch. buildSquadPlan is UNCHANGED.

-- A monotonic revision per member's shared plan, bumped only when the shared CONTENT changes. Lets a
-- re-share be idempotent (no bump when nothing changed) and gives the client a cheap "is my share
-- current?" signal for the live re-publish loop.
ALTER TABLE group_member ADD COLUMN plan_revision INTEGER NOT NULL DEFAULT 0;

-- The squad's plan-change history: one coalesced line per member burst. `kind` is share|unshare;
-- the counts describe the net effect; `pick_count` is the resulting shared-set count for the day.
-- The natural-language sentence is rendered CLIENT-SIDE (i18n) from these structured fields, so the
-- server stays locale-free (ÂNCORA: universal i18n).
CREATE TABLE group_plan_change (
  id              TEXT PRIMARY KEY,
  group_id        TEXT NOT NULL REFERENCES app_group(id),
  actor_user_id   TEXT NOT NULL REFERENCES app_user(id),
  day             TEXT,                          -- festival day affected (null for a full unshare)
  kind            TEXT NOT NULL,                 -- 'share' | 'unshare'
  added_count     INTEGER NOT NULL DEFAULT 0,
  removed_count   INTEGER NOT NULL DEFAULT 0,
  pick_count      INTEGER NOT NULL DEFAULT 0,    -- resulting shared picks for the day after the change
  revision        INTEGER NOT NULL DEFAULT 0,    -- the member's plan_revision at this change
  created_at_utc  TEXT NOT NULL,
  updated_at_utc  TEXT NOT NULL
);
CREATE INDEX idx_group_plan_change_group ON group_plan_change(group_id, created_at_utc DESC);
CREATE INDEX idx_group_plan_change_actor ON group_plan_change(group_id, actor_user_id, day);
