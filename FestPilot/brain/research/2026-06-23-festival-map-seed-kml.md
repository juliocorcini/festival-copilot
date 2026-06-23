# Research — Festival Map Seed from Google My Maps (KML)

> Last updated: 2026-06-23
> Status: usable **seed**, not source of truth. Source: a community Google My Maps ("TML 22 + Dreamland") exported to KML. Raw + extracted files live in `research/assets/tml-map-seed-2026-06-23/`.

> ✅ **CONFIRMED by spike (2026-06-23)** — `FestPilot/spikes/map-import/` parses this KML and auto-matches the 2026 lineup stages:
> - **47 features** parsed (20 points, 22 polygons, 5 lines).
> - **10/15 official stages auto-matched** — 9 high-confidence + `The Library → THE GREAT LIBRARY` (medium, via the alias table). Coords look right (Mainstage `51.09217, 4.38648`, etc.).
> - **6 points need review** (old/renamed): Harbour House, Mesa Garden, Youphoria, LEAF, Kara Savi, + "Home Base".
> - **5 official stages have no seed location** (admin must place): ELIXIR, PLANAXIS, MELODIA BY CORONA, CELESTIA BY KUCOIN, HOUSE OF FORTUNE BY JBL.
> - Practical layer seeded: **22 areas**, **4 entrances**, **5 paths**. Output: `out/admin-verify.html` (Leaflet, color-coded) + `out/imported-features.json`.

## TL;DR

A fan-made Google My Maps of Tomorrowland / DreamVille (made years ago) was exported to KML and parsed. It gives us **real coordinates for 10 stages that match the 2026 lineup with high confidence**, plus DreamVille areas, entrances, and paths. We treat it as an **unverified seed**: import → auto-match the obvious stages → flag old/renamed venues for manual review → an admin confirms location + radius before the app trusts it. After confirmation, the app uses **our database**, never the old map.

## Source & access

- Google My Maps map id (`mid`): `1cyRIOYkZMUYuX0TXIcWZTFdOBgFsqsY`.
- Public KML export pattern (when the map is public): `https://www.google.com/maps/d/kml?mid=<MID>&forcekml=1`. The browser tool could not open My Maps directly (auth/cookies), but Julio exported the KML manually (My Maps → three-dot menu → *Export to KML/KMZ*).
- Files captured into the brain (`research/assets/tml-map-seed-2026-06-23/`):
  - `TML 22 + Dreamland.kml` — the raw export.
  - `tml_22_dreamland_extracted_features.csv` — all 47 features, flattened.
  - `tml_22_dreamland_extracted_features.geojson` — map-ready (Leaflet/Mapbox).
  - `tml_stage_locations_matched_2026_seed.csv` — only the 10 stages matched to 2026.

## What the KML contains

- **47 features** total: **20 points**, **22 polygons**, **5 lines/paths**, in **1 layer** ("TMl.").
- Points = stages, entrances, and POIs. Polygons = DreamVille districts/camping areas. Lines = paths.
- **Coordinate order in KML is `longitude,latitude[,altitude]`** — NOT `lat,lng`. Inverting them lands you in the ocean. The extracted CSV/GeoJSON already store them correctly (GeoJSON uses `[lng, lat]`).

## Stages matched to the 2026 lineup (HIGH confidence)

These 10 points match official 2026 stage names by name + plausible location. Use as the initial `StageLocation` seed (admin still verifies + sets radius):

| Old map name | 2026 stage (match) | Latitude | Longitude |
|---|---|---|---|
| Freedom Stage | FREEDOM BY BUD | 51.0870526 | 4.3789244 |
| Rose Garden | THE ROSE GARDEN | 51.0875815 | 4.3800734 |
| Mainstage | MAINSTAGE | 51.0921683 | 4.3864793 |
| CAGE | CAGE | 51.0887504 | 4.3826684 |
| Rave Cave | THE RAVE CAVE | 51.0885148 | 4.3825680 |
| Atmosphere | ATMOSPHERE | 51.0899042 | 4.3835463 |
| CORE | CORE | 51.0894224 | 4.3843939 |
| Crystal Garden | CRYSTAL GARDEN | 51.0906994 | 4.3827738 |
| The Library | THE GREAT LIBRARY | 51.0932142 | 4.3833231 |
| Moose Bar | MOOSE BAR | 51.0943849 | 4.3847401 |

## Old / renamed venues — need manual review (DO NOT auto-trust)

Present in the KML but not safely matchable to a 2026 name. Surface as "unmatched" in admin; resolve via the alias table:

- Harbour House
- Mesa Garden
- Youphoria
- LEAF
- Kara Savi

These may be renamed stages, removed stages, or non-stage venues. An admin decides.

## DreamVille / practical layer (high value for the POI map)

Beyond stages, the KML seeds the **practical map layer** (see product-spec §8.1) and group/meeting-point references:

- **Entrances:** Main Entrance, Dreamville Entrance, Dreamville Entrance 1, Entrance 2.
- **Camping districts (polygons):** Yellow / Blue / Orange / Red / Green / Purple / Aqua District.
- **Accommodation areas:** Easy Tents, Spectacular Easy Tents, Dreamlodges, Spectacular Dreamlodges, Cabanas, Kokonos, The Mansions, Relax Rooms.
- **Service areas:** Market Place, Friendship Garden, Camp2Camp / Camp2CAMP PrePitched, ADA, Dreamville Chillout, Home Base.
- **Paths:** 5 lines (walking routes — useful later for travel-time seeding).

> Caveat: camping/area layouts change yearly more than stage positions. Treat areas as a rough starting shape to be confirmed, not as exact 2026 geometry.

## How we use it (the import → verify flow)

1. **Import** the KML/KMZ → normalize every Placemark into `ImportedMapFeature` (GeoJSON geometry + name + layer + source).
2. **Auto-match** stage points to official lineup stages by normalized name + proximity → the 10 above become `matched`.
3. **Flag** unmatched/old names as `needs review`; resolve with a `StageAlias` (old name → official stage, with confidence).
4. **Admin verifies** each stage: confirm location, set **radius** (V1 area model, DEC-010), optionally draw a polygon (V2).
5. **Promote** confirmed stages to `StageLocation`; promote confirmed POIs to the practical map layer.
6. From then on the app reads **our DB**; the KML is just the seed that saved hours of placing pins.

## Data shapes (seed/import)

```ts
type StageAlias = {
  festivalId: string;
  officialStageId: string;
  officialStageName: string;
  alias: string;                 // old/variant name from the map
  confidence: "high" | "medium" | "low";
};

type ImportedMapFeature = {
  id: string;
  festivalId: string;
  source: "google-my-maps-kml";
  sourceMapId: string;           // the My Maps mid
  name: string;
  description: string | null;
  layerName: string | null;
  geometryType: "point" | "line" | "polygon";
  geometryGeoJson: GeoJSON.Geometry;   // coordinates are [lng, lat]
  category: "stage" | "entrance" | "area" | "poi" | "path" | "unknown";
  matchedStageId: string | null;
  matchedStageName: string | null;
  status: "imported" | "matched" | "verified" | "ignored";
  confidence: "high" | "medium" | "low";
  createdAt: Date;
  updatedAt: Date;
};
```

`ImportedMapFeature` (verified) → promotes to `StageLocation` (technical-direction §4) for stages, or to a POI record for the practical layer.

## KML/KMZ parsing notes (Node)

- KMZ = zipped KML → unzip and read `doc.kml` (use `JSZip`); KML = read as UTF-8 directly.
- Parse with `fast-xml-parser` (`removeNSPrefix: true`); walk `kml.Document.Folder[].Placemark[]`.
- A Placemark has exactly one of `Point.coordinates`, `Polygon.outerBoundaryIs.LinearRing.coordinates`, or `LineString.coordinates`.
- Split coordinate strings on whitespace, then each on `,` → `[lng, lat, alt?]`. Emit GeoJSON with `[lng, lat]`.

## Related

- Stage data model: `../technical-direction.md` §4 (`StageLocation`, `StageTravelTime`).
- Map product behavior: `../product-spec.md` §8 (+ §8.1 practical POI layer).
- Decision: `../decision-log.md` DEC-021 (use the KML as an unverified seed; alias table; admin verifies).
- Lineup (stage *names* to match against): `2026-06-23-festival-lineup-data-source.md`.
