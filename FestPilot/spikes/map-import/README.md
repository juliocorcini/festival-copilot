# Spike — Map Import (KML seed)

Parses the community Google My Maps export (KML) into `ImportedMapFeature[]`, auto-matches
the **official lineup stages** (from the lineup spike's `stages` file), flags old/renamed
venues for review, and emits an **offline admin verify map**.

```
parse KML → ImportedMapFeature[] → auto-match official stages (normalized name + alias)
→ report (matched / needs-review / official-unplaced / areas+POIs) → out/admin-verify.html
```

## Why it exists

De-risk DEC-021: prove the KML seed can bootstrap the stage map and that auto-matching the
2026 stages works, leaving an admin to confirm location + radius (the only manual step).

## Run

```bash
npm install        # dev: fast-xml-parser, tsx, typescript (run once)
npm start          # parse + match + emit outputs
npm run typecheck  # tsc --noEmit
open out/admin-verify.html   # eyeball the pins on a real OSM map
```

## What it produces

- Console report: matched stages (KML name → official name + coords + confidence), points that
  need review, official stages with no seed location, and the practical-layer counts (areas, entrances, paths, POIs).
- `out/imported-features.json` — every feature with its category + match + status.
- `out/admin-verify.html` — a self-contained Leaflet map (no server) color-coded by status, with
  popups prompting the admin to confirm each stage's location and set its radius.

## Matching

`normalizeName()` drops sponsor suffixes (`… BY BUD`), `STAGE`, leading `THE`, and punctuation,
then matches against the official stage names. A tiny `ALIASES` table covers renames the
normalizer can't infer (e.g. `The Library` → `THE GREAT LIBRARY`). Everything unmatched is
flagged, never force-matched — an admin decides.

## Port to production

`kml.ts` + `match.ts` are runtime-agnostic and move into the admin/import path: imported rows
become `ImportedMapFeature`, and once an admin verifies, they promote to `StageLocation` / `Poi`
(see `../../brain/technical-direction.md` §4 and `../../brain/research/2026-06-23-festival-map-seed-kml.md`).
