-- R4.4 (DEC-055): capture "suggest a festival" requests from onboarding. No login required; an
-- optional caller id (anon firebase_uid) is recorded for frequency analytics. Suggestions dedupe on
-- a normalized name (lowercased, trimmed, collapsed whitespace) and increment a count, so the admin
-- inbox (R11) can rank demand. Status drives the back-office workflow.

CREATE TABLE festival_suggestion (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,                 -- as typed (display)
  name_normalized TEXT NOT NULL UNIQUE,          -- dedupe key
  suggested_by    TEXT,                          -- optional anon firebase_uid; nullable (no login)
  count           INTEGER NOT NULL DEFAULT 1,    -- how many times suggested
  status          TEXT NOT NULL DEFAULT 'new',   -- new / reviewing / planned / declined
  created_at_utc  TEXT NOT NULL,
  updated_at_utc  TEXT NOT NULL
);
CREATE INDEX idx_festival_suggestion_count ON festival_suggestion(count DESC, updated_at_utc DESC);
