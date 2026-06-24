-- R5.0 (DEC-060): lightweight identity captured at onboarding. `app_user` already carries
-- display_name + avatar; add the optional email (PII, never returned in the shared UserDto — admin
-- metrics only), the country derived server-side from `CF-IPCountry` (no GPS, just the request
-- edge), and a last-seen stamp refreshed on every /api/me touch. All feed the admin usage metrics
-- (DEC-057c / R11.4). Additive + nullable: existing rows keep working.

ALTER TABLE app_user ADD COLUMN email TEXT;
ALTER TABLE app_user ADD COLUMN country TEXT;
ALTER TABLE app_user ADD COLUMN last_seen_utc TEXT;
