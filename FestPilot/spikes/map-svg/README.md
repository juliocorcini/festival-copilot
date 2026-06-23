# Spike — Map SVG (OSM → stylized base + GPS transform)

Proves **DEC-031**: turn the real venue into the stylized **Amber-Glass** SVG we ship — **without
tracing satellite imagery**. It pulls the real geometry from **OpenStreetMap** (already vector,
already georeferenced, ODbL), styles it, overlays the seeded stages at their true coordinates, and
exports the **GPS → SVG affine transform** (DEC-030).

```
Overpass (OSM, ODbL) → osmtogeojson → classify layers (water / green / park / parking / roads / paths)
→ project each vertex (d3 geoMercator) → stylized Amber-Glass SVG (one <g> per layer)
→ overlay stages (KML seed, DEC-021) → fit + export affine (geoToSvg)  →  out/viewer.html
```

## Why it exists

Julio's question was *"how do we transform the real map into an SVG?"*. Answer (and what this proves):
do **not** AI-trace a Google satellite (ToS §21 forbids it; output is messy + ungeoreferenced).
Instead rebuild from OSM vector data and use AI only for the **art layer** (icons/decor, e.g. Recraft
V4 Vector) later. Building from a projection also makes the **GPS↔SVG transform exact** (residual ~0).

## Run

```bash
npm install            # d3-geo, osmtogeojson (+ dev: tsx, typescript, @resvg/resvg-js)
npm start              # fetch (cached) → classify → render → write outputs
REFRESH=1 npm start    # force a fresh Overpass fetch (otherwise uses out/osm-raw.json)
npm run typecheck      # tsc --noEmit
node preview.mjs       # rasterize out/desschorre-base.svg → out/preview.png (headless look)
open out/viewer.html   # base map + live "you/friends/meeting" dots placed via the 6 affine coeffs
```

## What it produces (in `out/`)

- `desschorre-base.svg` — the stylized Amber-Glass base map (warm dark base, ponds, woods, paths,
  roads, parking) with the 10 stages overlaid at their real GPS coordinates.
- `viewer.html` — the SVG inline + a JS demo that drops live dots using **only** the exported
  `{a,b,c,d,e,f}` (`geoToSvg(lng,lat)`), proving the GPS→SVG round-trip on real data.
- `transform.json` — canvas, bbox, the **affine coefficients**, and the residual vs the exact
  projection (≈0 px → an affine is plenty for a ~1 km site, confirming DEC-030).
- `desschorre.geojson` — the classified GeoJSON; `osm-raw.json` — cached Overpass response.
- `preview.png` — a headless raster of the base SVG.

## Gotchas learned (baked into the code)

- **Google imagery is off-limits** — ToS §21 forbids tracing/derivative works. OSM (ODbL) is the
  source; attribute it.
- **Drop the river** — the tidal **Rupel** (`water=river`) sits just outside the venue and is huge;
  rivers/canals + `waterway` lines are filtered out (only lake/pond polygons are kept).
- **Fill polygons, stroke lines** — filling an open `LineString` smears a huge wrong area.
- **`fitExtent` on a Polygon is a trap** — d3-geo's spherical winding reads the bbox ring as the
  whole globe and collapses the projection; fit to a **MultiPoint** of the corners instead.
- **Don't use `geoPath` for OSM polygons** — wrong ring winding makes it trace the global complement
  (10 M-px smears). We project each vertex ourselves with straight segments (exact at ~1 km).
- **Sanitize coordinates** — relations partly outside the bbox can resolve nodes to `(0,0)`.
- **Buildings excluded** — the bbox spills into Boom town (~2600 houses); on-site structures come
  from the POI layer (DEC-022).

## Port to production

`overpass.ts` + `render.ts` + `affine.ts` are runtime-agnostic. The production flow runs this **once
per venue** (offline), an artist polishes the SVG and adds **Recraft-generated** stage/POI icons +
decor, the stages get admin-verified (DEC-021), and the app ships the SVG + `transform.json` cached
for offline use (DEC-030 §5). See `../../brain/documents/2026-06-23-realtime-map-technical-plan.md` §8.
