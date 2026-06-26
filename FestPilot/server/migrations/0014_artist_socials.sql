-- ART-3 (DEC-069): capture the artist social links the source already ships (TML HAR, event TL26BE:
-- instagram, spotify, soundcloud, facebook, tiktok, youtube, website, twitter). One additive JSON
-- column on `artist` keeps it simple (a single nullable cell instead of eight sparse columns) and the
-- read API exposes it as ArtistDto.socials. Additive + nullable: existing reads/writes are untouched
-- and a normal re-ingestion backfills it idempotently (the upsert writes socials = excluded.socials).

ALTER TABLE artist ADD COLUMN socials TEXT;
