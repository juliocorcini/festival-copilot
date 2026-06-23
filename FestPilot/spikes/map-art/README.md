# map-art — the FestPilot map generator (DEC-033 Route A, DEC-034)

A **standalone, one-call engine** that turns a venue + its stage pins into a genuinely
**beautiful**, **georeferenced**, illustrated festival map — fully automated, from
open/legal data, on a plain machine (Node + resvg; **no Google imagery, no GDAL, no GPU**).
The bar is the official Tomorrowland maps (see the realtime-map technical plan §10/§11).

This started as the De Schorre beauty spike and is now the **productized generator** the
admin map-editor will call for **any festival, anywhere** (DEC-034).

## The engine

```ts
import { generateMap } from "./src/generate.js";
generateMap(input /* MapInput */, outDir, { fontFiles, refresh, log });
```

`MapInput` (`src/types.ts`) is all the admin produces — the **stage pins double as the
affine GCPs**; everything else is derived:

```jsonc
{
  "festivalId": "tomorrowland-deschorre",
  "title": "De Schorre",
  "subtitle": "Tomorrowland · Boom",
  "stages": [ { "name": "MAINSTAGE", "lng": 4.349, "lat": 51.088, "matched": true }, … ],
  "padMeters": 230,        // optional: bbox auto-derived from the pins if no `bbox`
  "relief": "auto",        // auto | flanders | global | none
  "reliefWidth": 3072,     // hillshade px (default 2048)
  "scale": 2               // PNG supersample (the shipped asset is the vector SVG)
}
```

## Pipeline (what one call derives)

1. **Extent** — snug bbox around the stage cluster (+pad), or `input.bbox`.
2. **Projection** — `d3-geo` `geoMercator` fit to a canvas whose aspect matches the bbox.
3. **Geometry** — Overpass/**OSM** (ODbL) water/wood/grass/parking/park + roads/paths,
   classified + projected to pixels (cached to `osm-<id>.json`).
4. **Transform** — fit the **affine** (GPS→SVG) from the stages; export the 6 coeffs.
5. **Relief** — auto-pick provider, drape under the art (cached `relief-*.png`).
6. **Canopy** — seeded tree scatter on wood/park polygons (painter-ordered) + under-masses.
7. **Render** — `buildArtSvg` in **two palettes** → SVG ×2, PNG ×2, transform, viewer.

## Usage

```bash
cd FestPilot/spikes/map-art && npm install
npm start                      # De Schorre (default; stages from the map-import KML seed)
npm start -- config/red-rocks-demo.json   # any venue (proves the global relief fallback)
REFRESH=1 npm start            # re-fetch OSM + relief (otherwise cached in out/)
npm run typecheck

npm run admin                  # admin map editor → http://localhost:8799
                               #   drag/name/verify stage pins → Generate → preview day/night
```

### Admin map editor (`admin/`)

The map editor (DEC-034 §11.7) is the human surface around the engine: a Leaflet
reference base map where the admin **drops/drag-corrects stage pins** (the only spatial
input — they double as the affine GCPs), names + verifies them, and clicks **Generate**.
A tiny Node server (`admin/server.ts`, built-in `http`, no extra deps) serves the page,
prefills from the KML seed (`GET /api/seed/deschorre`), runs the engine on
`POST /api/generate`, and serves the result for preview. The base map is OSM **for
placement reference only — never traced or baked** (DEC-031).

## Outputs (`out/<id>…`)

| file | role |
|---|---|
| `<id>.svg`, `<id>-day.svg` | **shipped deep-zoom assets** — vector, twilight + day |
| `<id>.png`, `<id>-day.png` | preview rasters (`scale`× supersampled) |
| `<id>-transform.json` | 6 affine coefficients + bbox + residual → runtime `geoToSvg` |
| `<id>-viewer.html` | **day/night toggle** (Auto by local time + manual) + live GPS dots |
| `osm-<id>.json`, `relief-*.png` | caches (delete to force a refetch) |

Fonts (`fonts/Oswald.ttf`, `fonts/AlbertSans.ttf`) are baked into the PNGs by resvg so
the title/labels are the real condensed type, not a serif fallback.

Dev helpers: `scripts/crop.ts in x y w h scale out` (zoom into a PNG to inspect detail),
`scripts/render.ts in.svg width out.png` (rasterize the SVG at any width — proves the
vector deep-zoom headroom).

## What makes it beautiful (bottom → top)

- **Real terrain relief** — the single biggest "this is a real place" win. `auto` uses
  **Flanders DHMV-II HILL 25 cm** (pre-rendered LiDAR hillshade via WMS, EPSG:3857) where
  available, else a **global** provider (AWS Open Terrain Tiles → JS hillshade) so any
  venue gets relief. Draped via `feColorMatrix` filters (transparent on flats; darken
  shadow slopes / warm lit ones).
- **Painterly water** — gradient + turbulence ripple + shoreline + glow + sheen.
- **2.5-D tree canopy** — jittered point-in-polygon scatter, painter-ordered, with feature
  trees + tonal under-masses; lawns/water/parking left as clearings.
- **Atmosphere** — golden-hour wash, paper grain, focus veil + amber edge halo, vignette.
- **Illuminated stage medallions** — pedestal shadow → glow → disc → ink rim → rim-light →
  star → top gloss; **needs-review** pins render dashed/muted.
- **Festival-map chrome** — ornate frame, **8-point compass rose**, title flourish, legend.
- **Two palettes** — **twilight** (on-brand Amber Glass) + **day** (bright, ≈ the official
  2022 / Floorplan refs); both shipped, app switches by local time.

## Gotchas baked in (so we don't relearn them)

- **Node `fetch` (undici) hangs** on the Flanders WMS (curl returns the PNG in ~2 s). We
  fetch via **`curl`** (`src/http.ts`, `--max-time`); relief degrades gracefully if it fails.
- **Hillshade is mid-grey on flats.** We center the relief on mid-grey via `feColorMatrix`
  so flats stay untouched and only slopes shade — no whole-map desaturation.
- **No GDAL.** Flanders publishes the shaded relief; the global provider computes Horn
  (1981) hillshade in JS from terrarium tiles. No external GIS.
- **Relief without a park polygon.** If OSM has no venue polygon (e.g. Red Rocks), the
  relief is clipped to the full canvas instead of an empty path, so terrain still shows.
- **Projection match.** Relief is requested/built in **EPSG:3857** (same as d3
  `geoMercator`) and placed by mapping the bbox corners through the affine.
- **Determinism.** All scatter uses a seeded PRNG (`mulberry32`).

## Data & licenses

- Geometry: **© OpenStreetMap contributors (ODbL)** — attribution shown on the map.
- Relief: **DHMV-II, Digitaal Vlaanderen** (free-reuse) / **AWS Open Terrain Tiles**
  (Mapzen/SRTM, public) — attribution shown on the map.
- Fonts: **Oswald**, **Albert Sans** (SIL OFL).

## Porting to production (see plan §11.7–§11.8)

- Run `generateMap` as a **Worker/queue job** at admin time (Overpass + relief are
  network/CPU); store `<id>.svg` + `transform.json` in **R2/D1** by `festivalId`.
- **Deep zoom**: ship the **vector SVG** and/or a raster tile pyramid; don't rasterize
  giant PNGs per request.
- **Slim the SVG**: replace the inline base64 relief with an **external file/tiles**; run SVGO.
- Swap the generic star medallions for **bespoke per-stage icons** (Recraft V4 Vector).
- Keep the **affine + live overlay** exactly as-is (DEC-030). Painterly **Route B** /
  3D **Route C** are documented in the plan §10 and need external GPU/services.
