-- R11.2 (DEC-057a): per-festival data-source registry. Documents WHERE a festival's lineup data
-- comes from and HOW it's captured. Distinct from the operational `lineup_source` (which the
-- ingester writes on every run): this is the operator-curated record, with a manual path for
-- festivals without a clean official source, and a reserved flag for a future AI-assisted reader.
--
-- origin:
--   official_page -> resolve event+uuid from the official page, then the CDN JSON (DEC-009)
--   manual        -> entered by hand (no clean machine source)
--   ai_assisted   -> an AI reader pre-filled the lineup/timetable (reader built later)

CREATE TABLE festival_data_source (
  festival_id       TEXT PRIMARY KEY REFERENCES festival(id),
  origin            TEXT NOT NULL DEFAULT 'official_page',
  page_url          TEXT,
  event             TEXT,                          -- e.g. "TL26BE"
  uuid              TEXT,                          -- resolved, never hardcoded
  capture_method    TEXT,                          -- human description of the capture
  notes             TEXT,
  ai_reader_enabled INTEGER NOT NULL DEFAULT 0,    -- future AI-assisted reader (build later)
  updated_at_utc    TEXT NOT NULL
);
