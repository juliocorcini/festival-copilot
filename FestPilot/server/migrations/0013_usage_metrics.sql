-- R11.4 (DEC-057c) + R11.5 (DEC-057d): admin usage metrics + free-tier runway, and the test flag.
--
-- `is_test` on app_user: marks synthetic users injected by the R11.5 live test console so they are
-- NEVER counted in real usage metrics and can be purged. Real users default to 0.
--
-- `usage_counter`: a tiny daily rollup (one row per kind per UTC day) incremented in-place, so the
-- table never grows unbounded and gives a first-party per-day rate for the runway math. We only
-- count our OWN app touches here (a lower bound on Workers requests); exact platform consumption
-- (Workers/D1/Durable Objects) comes from Cloudflare GraphQL Analytics when a token is configured.

ALTER TABLE app_user ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0;

CREATE TABLE usage_counter (
  day   TEXT NOT NULL,                 -- UTC date, YYYY-MM-DD
  kind  TEXT NOT NULL,                 -- e.g. 'me_touch'
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
