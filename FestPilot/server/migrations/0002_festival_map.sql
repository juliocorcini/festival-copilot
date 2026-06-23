-- Map asset registry (DEC-040). The shipped base is a static WebP raster + the affine
-- transform that drops the live overlay onto it (DEC-030/034). No R2 in V1 (DEC-038):
-- the base lives as a static Pages asset. This row records the asset keys + the transform
-- so `GET /api/festivals/:id/map` is the single source of "where the map is" and the model
-- stays multi-festival ready (swap the keys for R2/CDN URLs later without an app change).

CREATE TABLE festival_map (
  festival_id     TEXT PRIMARY KEY REFERENCES festival(id),
  asset_slug      TEXT NOT NULL,            -- filename prefix, e.g. "tomorrowland-deschorre"
  base_night_key  TEXT NOT NULL,            -- static key, e.g. "maps/tomorrowland-deschorre.webp"
  base_day_key    TEXT NOT NULL,            -- static key, e.g. "maps/tomorrowland-deschorre-day.webp"
  transform_json  TEXT NOT NULL,            -- 6-coeff affine + canvas + bbox + stages (DEC-030)
  revision        INTEGER NOT NULL DEFAULT 1,
  updated_at_utc  TEXT NOT NULL
);
