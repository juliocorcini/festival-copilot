-- FestPilot V1 — initial D1 (SQLite) schema.
-- Source of truth: FestPilot/brain/documents/v1-data-model-d1-schema.md
-- Designed fully in Phase 1; later phases populate behavior (ordering rule 7).
--
-- Conventions:
--   * Instants are TEXT, ISO-8601 UTC ("2026-07-17T19:00:00Z").
--   * IDs are TEXT ULIDs; source-owned rows also keep source_*_id for idempotent upserts.
--   * Booleans are INTEGER (0/1).
--   * Reserved word note: the domain "group" is the physical table `app_group`
--     (SQLite reserves GROUP); related tables keep the group_* prefix.

-- ===========================================================================
-- Lineup domain (server-owned, read-mostly)
-- ===========================================================================

CREATE TABLE festival (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  timezone       TEXT NOT NULL,
  created_at_utc TEXT NOT NULL
);

CREATE TABLE weekend (
  id          TEXT PRIMARY KEY,
  festival_id TEXT NOT NULL REFERENCES festival(id),
  name        TEXT NOT NULL,            -- "W1" / "W2"
  start_date  TEXT,                     -- source local "YYYY-MM-DD HH:mm"
  end_date    TEXT
);
CREATE INDEX idx_weekend_festival ON weekend(festival_id);
CREATE UNIQUE INDEX uq_weekend_festival_name ON weekend(festival_id, name);

CREATE TABLE stage (
  id              TEXT PRIMARY KEY,
  festival_id     TEXT NOT NULL REFERENCES festival(id),
  source_stage_id TEXT NOT NULL,        -- e.g. "2643200378"
  name            TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_stage_festival ON stage(festival_id);
CREATE UNIQUE INDEX uq_stage_source ON stage(festival_id, source_stage_id);

CREATE TABLE artist (
  id               TEXT PRIMARY KEY,
  source_artist_id TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  image_url        TEXT
);

CREATE TABLE performance (
  id                    TEXT PRIMARY KEY,
  festival_id           TEXT NOT NULL REFERENCES festival(id),
  weekend_id            TEXT REFERENCES weekend(id),
  stage_id              TEXT REFERENCES stage(id),
  source_performance_id TEXT NOT NULL,           -- idempotent upsert key (per festival)
  name                  TEXT NOT NULL,
  day                   TEXT,                     -- festival day label, e.g. "SATURDAY"
  date_local            TEXT,                     -- calendar date of start, "2026-07-19"
  start_at_utc          TEXT,                     -- instant
  end_at_utc            TEXT,                     -- instant (+1s quirk stripped, midnight handled)
  raw_start_time        TEXT,                     -- source string ("...+02:00")
  raw_end_time          TEXT,
  is_placeholder        INTEGER NOT NULL DEFAULT 0,
  active                INTEGER NOT NULL DEFAULT 1,  -- removed acts -> 0, never hard-deleted
  source_hash           TEXT,                     -- per-performance change detection
  last_imported_at_utc  TEXT
);
CREATE UNIQUE INDEX uq_performance_source ON performance(festival_id, source_performance_id);
CREATE INDEX idx_performance_festival_day_start ON performance(festival_id, day, start_at_utc);
CREATE INDEX idx_performance_stage_start ON performance(stage_id, start_at_utc);
CREATE INDEX idx_performance_weekend ON performance(weekend_id);

CREATE TABLE performance_artist (
  performance_id TEXT NOT NULL REFERENCES performance(id),
  artist_id      TEXT NOT NULL REFERENCES artist(id),
  sort_order     INTEGER NOT NULL DEFAULT 0,      -- b2b order
  PRIMARY KEY (performance_id, artist_id)
);
CREATE INDEX idx_performance_artist_artist ON performance_artist(artist_id);

CREATE TABLE lineup_source (
  id                TEXT PRIMARY KEY,
  festival_id       TEXT NOT NULL REFERENCES festival(id),
  event             TEXT NOT NULL,                -- e.g. "TL26BE"
  uuid              TEXT NOT NULL,                -- resolved, never hardcoded
  source_page_url   TEXT NOT NULL,
  first_seen_at_utc TEXT NOT NULL,
  last_seen_at_utc  TEXT NOT NULL,
  active            INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_lineup_source_festival ON lineup_source(festival_id);

CREATE TABLE lineup_import_run (
  id               TEXT PRIMARY KEY,
  source_id        TEXT NOT NULL REFERENCES lineup_source(id),
  status           TEXT NOT NULL,                 -- no_changes / updated / error
  started_at_utc   TEXT NOT NULL,
  finished_at_utc  TEXT,
  config_hash      TEXT,                          -- SHA-256 of config payload
  stages_hash      TEXT,                          -- SHA-256 of stages + weekend payloads
  changes_count    INTEGER NOT NULL DEFAULT 0,
  error            TEXT
);
CREATE INDEX idx_import_run_source ON lineup_import_run(source_id);

CREATE TABLE lineup_change (
  id              TEXT PRIMARY KEY,
  import_run_id   TEXT NOT NULL REFERENCES lineup_import_run(id),
  performance_id  TEXT REFERENCES performance(id),  -- NULL for "added" before insert
  change_type     TEXT NOT NULL,  -- added/removed/time_changed/stage_changed/artist_changed
  before_json     TEXT,
  after_json      TEXT,
  detected_at_utc TEXT NOT NULL
);
CREATE INDEX idx_lineup_change_run ON lineup_change(import_run_id);

CREATE TABLE lineup_revision (
  festival_id    TEXT PRIMARY KEY REFERENCES festival(id),
  revision       INTEGER NOT NULL DEFAULT 0,      -- bumped on any change; clients poll this
  updated_at_utc TEXT NOT NULL
);

-- ===========================================================================
-- Map / geo domain
-- ===========================================================================

CREATE TABLE stage_location (
  stage_id        TEXT PRIMARY KEY REFERENCES stage(id),
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,
  radius_meters   INTEGER NOT NULL,               -- V1 = circle
  polygon_geojson TEXT,                            -- V2
  color           TEXT,
  source          TEXT NOT NULL,                   -- manual/imported_map/official/mixed
  verified        INTEGER NOT NULL DEFAULT 0,
  verified_at_utc TEXT
);

CREATE TABLE stage_travel_time (
  id              TEXT PRIMARY KEY,
  festival_id     TEXT NOT NULL REFERENCES festival(id),
  from_stage_id   TEXT NOT NULL REFERENCES stage(id),
  to_stage_id     TEXT NOT NULL REFERENCES stage(id),
  minutes_typical INTEGER NOT NULL,
  minutes_crowded INTEGER,
  source          TEXT NOT NULL                    -- estimated/manual/learned(V2)
);
CREATE INDEX idx_travel_festival ON stage_travel_time(festival_id);
CREATE UNIQUE INDEX uq_travel_pair ON stage_travel_time(from_stage_id, to_stage_id);

CREATE TABLE poi (
  id          TEXT PRIMARY KEY,
  festival_id TEXT NOT NULL REFERENCES festival(id),
  type        TEXT NOT NULL,  -- toilet/water/food/medical/exit/atm/charging/locker/entrance/landmark
  name        TEXT,
  lat         REAL NOT NULL,
  lng         REAL NOT NULL,
  source      TEXT NOT NULL,                       -- imported_map/manual
  verified    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_poi_festival ON poi(festival_id);

CREATE TABLE imported_map_feature (
  id               TEXT PRIMARY KEY,
  festival_id      TEXT NOT NULL REFERENCES festival(id),
  source           TEXT NOT NULL,                  -- google-my-maps-kml
  source_map_id    TEXT,                           -- the "mid"
  name             TEXT NOT NULL,
  layer_name       TEXT,
  geometry_type    TEXT NOT NULL,                  -- Point/Polygon/LineString
  geometry_geojson TEXT NOT NULL,                  -- [lng,lat] order
  category         TEXT NOT NULL,                  -- stage/entrance/area/path/poi
  matched_stage_id TEXT REFERENCES stage(id),
  match_confidence TEXT,                           -- high/medium/low
  status           TEXT NOT NULL                   -- imported/matched/needs_review/verified/ignored
);
CREATE INDEX idx_imported_feature_festival ON imported_map_feature(festival_id);

CREATE TABLE stage_alias (
  id                TEXT PRIMARY KEY,
  festival_id       TEXT NOT NULL REFERENCES festival(id),
  official_stage_id TEXT NOT NULL REFERENCES stage(id),
  alias             TEXT NOT NULL,                 -- old/variant name
  confidence        TEXT
);
CREATE INDEX idx_stage_alias_festival ON stage_alias(festival_id);
CREATE INDEX idx_stage_alias_stage ON stage_alias(official_stage_id);

-- ===========================================================================
-- Personal domain
-- ===========================================================================

-- Auth = Firebase Auth, anonymous-first + social upgrade (DEC-024).
-- Anonymous from Phase 1; a permanent account (is_anonymous=0) is required for groups.
CREATE TABLE app_user (
  id             TEXT PRIMARY KEY,
  firebase_uid   TEXT NOT NULL UNIQUE,            -- stable across anon->permanent linking
  auth_provider  TEXT NOT NULL,                    -- anonymous/google/apple/email_link
  is_anonymous   INTEGER NOT NULL DEFAULT 1,
  display_name   TEXT,
  avatar_url     TEXT,
  locale         TEXT,
  created_at_utc TEXT NOT NULL
);

CREATE TABLE device (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES app_user(id),
  platform         TEXT NOT NULL,                  -- ios/android/web
  fcm_token        TEXT NOT NULL UNIQUE,
  last_seen_at_utc TEXT NOT NULL
);
CREATE INDEX idx_device_user ON device(user_id);

-- Pillar 1: overlaps allowed.
CREATE TABLE favorite (
  user_id        TEXT NOT NULL REFERENCES app_user(id),
  performance_id TEXT NOT NULL REFERENCES performance(id),
  created_at_utc TEXT NOT NULL,
  PRIMARY KEY (user_id, performance_id)
);
CREATE INDEX idx_favorite_performance ON favorite(performance_id);

-- Pillar 2: "My Plan" / "Lock in". Invariant: no two slots for the same user overlap in time.
CREATE TABLE plan_slot (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES app_user(id),
  festival_id            TEXT NOT NULL REFERENCES festival(id),
  day                    TEXT,
  performance_id         TEXT NOT NULL REFERENCES performance(id),
  start_override_utc     TEXT,                     -- partial-set cut-in
  end_override_utc       TEXT,                     -- partial-set cut-out ("leave early")
  transition_to_stage_id TEXT REFERENCES stage(id),
  transition_feasible    INTEGER,                  -- computed vs travel time
  note                   TEXT
);
CREATE INDEX idx_plan_slot_user ON plan_slot(user_id);
CREATE INDEX idx_plan_slot_festival ON plan_slot(festival_id);

-- ===========================================================================
-- Social domain (Pillar 3)
-- ===========================================================================

CREATE TABLE app_group (
  id                 TEXT PRIMARY KEY,
  festival_id        TEXT NOT NULL REFERENCES festival(id),
  name               TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  created_at_utc     TEXT NOT NULL
);
CREATE INDEX idx_group_festival ON app_group(festival_id);

CREATE TABLE group_member (
  group_id        TEXT NOT NULL REFERENCES app_group(id),
  user_id         TEXT NOT NULL REFERENCES app_user(id),
  role            TEXT NOT NULL DEFAULT 'member',  -- owner/member
  nickname        TEXT,
  share_location  TEXT NOT NULL DEFAULT 'off',     -- off/while_using/live_until
  share_until_utc TEXT,                            -- time-boxed live sharing
  joined_at_utc   TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE group_invite (
  id                 TEXT PRIMARY KEY,
  group_id           TEXT NOT NULL REFERENCES app_group(id),
  token              TEXT NOT NULL UNIQUE,         -- encodes the link/QR
  created_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  expires_at_utc     TEXT,
  max_uses           INTEGER,
  uses               INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_group_invite_group ON group_invite(group_id);

CREATE TABLE group_plan_slot (
  id                    TEXT PRIMARY KEY,
  group_id              TEXT NOT NULL REFERENCES app_group(id),
  day                   TEXT,
  time_block            TEXT NOT NULL,             -- the slot key
  chosen_performance_id TEXT REFERENCES performance(id),
  method                TEXT NOT NULL,             -- plurality/favorites_fallback/owner
  tally_json            TEXT,                      -- who-picked-what counts
  updated_at_utc        TEXT NOT NULL
);
CREATE INDEX idx_group_plan_slot_group ON group_plan_slot(group_id);

-- DEC-013: lightweight pinned board (V1). Distinct from chat.
CREATE TABLE group_board_note (
  id             TEXT PRIMARY KEY,
  group_id       TEXT NOT NULL REFERENCES app_group(id),
  author_user_id TEXT NOT NULL REFERENCES app_user(id),
  body           TEXT NOT NULL,
  pinned         INTEGER NOT NULL DEFAULT 0,
  created_at_utc TEXT NOT NULL,
  updated_at_utc TEXT
);
CREATE INDEX idx_group_board_note_group ON group_board_note(group_id);

-- Coarse presence. Raw lat/lng are SERVER-ONLY (never returned to clients).
CREATE TABLE presence (
  id                TEXT PRIMARY KEY,
  group_id          TEXT NOT NULL REFERENCES app_group(id),
  user_id           TEXT NOT NULL REFERENCES app_user(id),
  stage_id          TEXT REFERENCES stage(id),    -- resolved coarse stage
  current_artist_id TEXT REFERENCES artist(id),   -- auto from lineup
  coarse_label      TEXT NOT NULL DEFAULT 'none', -- at/near/between/none
  between_stage_id  TEXT REFERENCES stage(id),    -- for "between A and B"
  lat               REAL,                          -- SERVER-ONLY
  lng               REAL,                          -- SERVER-ONLY
  accuracy_meters   INTEGER,
  confidence        TEXT,                          -- high/medium/low
  source            TEXT,                          -- gps/manual/push_reply
  updated_at_utc    TEXT NOT NULL,
  expires_at_utc    TEXT NOT NULL                  -- gps ~15m, manual/push ~45m
);
CREATE UNIQUE INDEX uq_presence_group_user ON presence(group_id, user_id);  -- latest-only

-- Exact, opt-in, temporary meeting points (the only place exact coords leave the server).
CREATE TABLE meeting_point (
  id                 TEXT PRIMARY KEY,
  group_id           TEXT NOT NULL REFERENCES app_group(id),
  created_by_user_id TEXT NOT NULL REFERENCES app_user(id),
  title              TEXT,
  note               TEXT,
  lat                REAL NOT NULL,                -- exact (opt-in share)
  lng                REAL NOT NULL,
  accuracy_meters    INTEGER,
  photo_url          TEXT,                         -- R2 object
  visibility         TEXT NOT NULL DEFAULT 'group',-- group/selected
  status             TEXT NOT NULL DEFAULT 'active', -- active/expiring_soon/expired/empty/archived
  is_safety          INTEGER NOT NULL DEFAULT 0,   -- true for "I'm lost" / safety share
  created_at_utc     TEXT NOT NULL,
  expires_at_utc     TEXT NOT NULL                 -- 10/20/30/60 min
);
CREATE INDEX idx_meeting_point_group ON meeting_point(group_id);

CREATE TABLE meeting_point_member (
  meeting_point_id TEXT NOT NULL REFERENCES meeting_point(id),
  user_id          TEXT NOT NULL REFERENCES app_user(id),
  status           TEXT NOT NULL DEFAULT 'going',  -- going/arrived/left/not_going
  updated_at_utc   TEXT NOT NULL,
  PRIMARY KEY (meeting_point_id, user_id)
);

CREATE TABLE notification (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES app_user(id),
  type         TEXT NOT NULL,  -- where_is_everyone/meeting_point/still_there/group_heading/leave_now/safety/lineup_change
  payload_json TEXT NOT NULL,
  sent_at_utc  TEXT NOT NULL,
  read_at_utc  TEXT
);
CREATE INDEX idx_notification_user ON notification(user_id);
