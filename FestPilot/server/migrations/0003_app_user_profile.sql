-- Social-layer profile (DEC-039: profile asked at first group join — display name + avatar).
-- `app_user` already carries display_name + avatar_url; add the "dot color" the user picks at
-- profile setup (used for member lists now and the map presence dot in Phase 5). Additive only.
ALTER TABLE app_user ADD COLUMN avatar_color TEXT;
