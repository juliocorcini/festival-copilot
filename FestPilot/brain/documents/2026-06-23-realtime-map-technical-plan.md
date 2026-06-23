# FestPilot — Real-time Interactive Map: Technical Plan

> Created 2026-06-23. Answers Julio's questions: "how do we actually build the
> interactive, real-time illustrated map?" (§2–§7), **"how do we turn the real venue
> into the SVG we use?"** (§8 — the production pipeline), **and "how do we make that map as
> *beautiful* as the official Tomorrowland maps, automatically?"** (§10 — the art pipeline; added
> 2026-06-23). Grounded in web research + our existing assets (KML map seed DEC-021, map-import +
> map-svg spikes). Pairs with `technical-direction.md` and `decision-log.md` (DEC-021, DEC-030, DEC-031, DEC-033).

## 1. Goal & constraints

A **stylized/illustrated** map (Amber Glass look — not a Google-Maps tile look) that is:
- **Interactive**: pan, zoom, tap stages/POIs.
- **Georeferenced**: real GPS positions map onto the illustration, so "you are here" and friends land in the right spot.
- **Real-time**: my location + my group's locations + meeting pins update live.
- **Offline-first & battery-aware**: works mid-crowd with no signal; never constant GPS (DEC-012, DEC-022).
- Reference venue: **Tomorrowland, Boom (Belgium)** — a compact ~1 km site, so map projection math is trivial (curvature negligible).

## 2. The core idea — georeference via an affine transform

Standard GIS technique (confirmed by research): pair a few **Ground Control Points (GCPs)** — each a known **(svgX, svgY) ↔ (lng, lat)** — and fit a **2D affine transform** (scale + rotate + skew + translate). With ≥3 (ideally 4–6 well-spread) GCPs you get a 6-coefficient matrix that converts **any** GPS point to a position on the illustration.

- We already have real stage coordinates from the **KML seed** (DEC-021): the map-import spike auto-matched **10/15 stages** (5 need manual placement + admin verify). Those verified stage positions are our GCPs.
- Fit the matrix **once, offline** (Python `rasterio.transform.from_gcps` or `scikit-image estimate_transform('affine')`), store the **6 coefficients per festival map** in D1.
- At runtime (JS), applying the matrix is a couple of multiplies: `geoToSvg(lng,lat) → (x,y)`. Cheap, no dependency.
- A simple **affine** is enough for ~1 km. If residual error is high, step up to a **similarity/Helmert** fit or piecewise/triangulated warp. Keep the GCP list + residuals so we can audit accuracy.

## 3. Two architectures (and the V1 choice)

### Option A — Custom illustrated SVG + affine transform  ✅ RECOMMENDED FOR V1
- Our hand-authored SVG (the Amber Glass illustration: paths, lake, greens, stages, POIs) is the map.
- Layers: (1) base art, (2) POI layer (toilets/water/food/medical/exits/ATM/charging/lockers — seeded from KML, admin-verified, DEC-022), (3) stage layer with **custom per-stage icons**, (4) dynamic overlay (me, friends, meeting pins).
- Presence/markers are an overlay (absolute-positioned HTML or an SVG/Canvas layer) positioned with `geoToSvg`.
- Pan/zoom via CSS transform on the SVG group (pointer drag + wheel/pinch), or a tiny lib (`svg-pan-zoom`). Scrollbars always hidden.
- **Pros**: total art control (brand), **trivial offline** (it's a bundled/cached asset), lightest weight, best battery, no map vendor, no tiles.
- **Cons**: we implement pan/zoom and clustering ourselves; no built-in rotation-by-heading or deep zoom.

### Option B — MapLibre GL JS (open-source) as an upgrade path
- Use the illustration as a **georeferenced image overlay** (`ImageSource` with 4 corner lng/lat) **or** build a custom illustrated **vector style**; plugins: `@naivemap/maplibre-gl-image-layer` (proj4), Allmaps `WarpedMapLayer` (IIIF, overkill).
- Markers placed directly by **lng/lat** (`maplibregl.Marker`); pan/zoom/rotate/pitch for free; **offline via PMTiles + Service Worker** caching of sprites/glyphs.
- **Pros**: robust map engine, heading rotation, deep zoom, "navigate to" UX, future multi-festival.
- **Cons**: heavier bundle + battery; the illustrated look is constrained to an overlay/style; more moving parts for offline.

**Decision (DEC-030): start with Option A for V1**; keep Option B as the documented upgrade if we need heading-rotation, deep zoom, or turn-by-turn. The two share the same GCP/transform work, so switching later is cheap.

## 4. Real-time presence pipeline

1. **Capture**: foreground GPS, **battery-aware sampling** — on map open, on significant movement, and a low-frequency timer; last-known fallback; never constant GPS (DEC-012, DEC-022).
2. **Send**: client → Worker → **per-group Durable Object** (DEC-004) holds presence state and fans out to group members (WebSocket / push fallback).
3. **Privacy** (DEC-015): location only for friends **who opted in**; default **coarse** display = snap to **nearest stage** ("Andy is at MAINSTAGE"); a precise "radar" is explicit opt-in. "Location off" members shown greyed.
4. **Render**: each client runs `geoToSvg(lng,lat)` and draws avatars on the overlay; cluster when close; "me" shows an accuracy ring.
5. **Meeting point**: a shared geo point (+ photo + note, DEC-022) rendered with the same transform; the **compass/arrow** uses device heading + bearing-to-target (great-circle bearing) for in-crowd navigation (no turn-by-turn).

## 5. Offline & battery

- Bundle/cache in the PWA (Service Worker + OPFS): the **SVG art**, **POI/stage JSON**, and the **transform coefficients**. All map rendering then works with zero network.
- GPS adaptive duty-cycle; show "last synced" for friends when offline; presence resumes on reconnect.

## 6. Build steps (a concrete spike)

1. **Finalize stage coordinates** — admin-verify the 10 matched + place the 5 missing (ELIXIR, PLANAXIS, MELODIA, CELESTIA, HOUSE OF FORTUNE) on the verified map (extends the map-import spike's admin map).
2. **Author the illustrated SVG** aligned to those positions (or AI-generate then trace); design **custom per-stage icons** + POI icons.
3. **Compute the affine matrix** from the GCPs (offline script); record residuals.
4. **Map-render spike**: load SVG → place stages via transform → drop a fake GPS point and confirm it lands correctly → pan/zoom → add a presence overlay with 2–3 fake friends + a meeting pin + compass arrow.
5. Wire to the real presence channel in Phase 5/6 (live presence, meeting points + nav — DEC-023 phase order).

## 7. Open UX answers (from this review)

- **Bottom sheet (drag up)** = progressive detail: collapsed shows *now/next + route*; half shows *search results + nearby stages/POIs + friends list*; full shows *filters + full POI directory + selected-item details* (stage info, "navigate", set times).
- **Settings (the `tune`/top-right control)** = **map layers & preferences**: toggle layers (friends, stages, POI categories: WC/water/food/medical/exits/ATM/charging/lockers), labels on/off, **location-sharing precision** (off / by-stage / precise), **follow-me** recenter, high-contrast/sun mode.
- **Stage icons**: replace letter initials with a **custom icon per stage** (brand iconography). Prototype #19 now uses Material Symbols as placeholders to show the direction; final = bespoke set.

## 8. Producing the map asset: real venue → stylized SVG (Julio's core question)

> Julio's real question wasn't *how the map works* (§2–§3) — it's **how we actually turn the real
> venue into the SVG we use**: "take the real Google-Maps satellite of the site, process it, and
> reverse it into an SVG. Can our Groq AI do that?" Researched 2026-06-23. Short answer: **don't
> trace a satellite photo with AI** — it's a legal + quality dead end; instead **rebuild the geometry
> from open vector data and use AI only for the art**. Details below.

### 8.0 Reframe: this is a one-time *production* task, not a runtime conversion
The venue (De Schorre, Boom) barely changes year to year. We author **one finished SVG per festival map**, re-touched only when stages move. So we can afford a careful **semi-automated design pipeline**, not an automatic "satellite photo in → SVG out" service running in the app. That single insight removes most of the difficulty.

### 8.1 Why NOT "satellite photo → AI → SVG" (the tempting path, rejected)
- **Legal blocker (decisive):** Google Maps/Earth ToS **explicitly prohibits tracing or creating derivative works** from their imagery — §21 lists "*tracing or copying the copyrightable elements of Google's maps … and creating a new work, such as a new mapping dataset*" as prohibited. So we **cannot** take a Google satellite image and turn it into our map. (Same for copying their POIs.) Sources that *do* permit tracing: **Esri World Imagery, Bing Aerial, OpenAerialMap, Mapbox Satellite** (under their terms).
- **Wrong tool — "Groq":** Groq is a **fast LLM inference** provider (text + *vision* LLMs like Llama). It does **not generate images or SVG**. A vision-LLM can *look at* an image and describe/segment it, or emit a few crude `<path>`s, but it cannot author an accurate, georeferenced map. The **only AI that outputs *native* (non-traced) SVG** today is **Recraft V4 Vector** — and even that is built for **icons / flat illustrations / brand art**, not spatially-accurate terrain.
- **Quality:** auto-tracers (**VTracer**, **Potrace**) turn a photo into **thousands of messy paths** that aren't stylized and aren't georeferenced. Great for a logo, wrong for a clean branded map.

### 8.2 The recommended pipeline — rebuild geometry from open data, AI for the art (3 layers)
**Layer A — Spatial truth from OpenStreetMap (already vector, already georeferenced).**
The real shapes Julio wants (the lake, footpaths, tree masses, parking, roads, the park outline) **already exist as vectors** in **OpenStreetMap**, with real lat/lng and a license we can use (**ODbL** — just attribute). No photo, no tracing.
- Pull with **Overpass API** / QGIS **QuickOSM** → **GeoJSON** (`osmtogeojson`). Query water (`natural=water` — the lake), woods/green (`natural=wood`, `leisure=park`), paths (`highway=footway/path`), parking, roads.

**Layer B — Festival overlay (we author, no license issue).**
Place **stages + POIs** from our **KML seed (DEC-021, admin-verified)** at their real GPS coords on top of Layer A.

**Layer C — Style + bespoke art (where AI helps).**
- Convert the GeoJSON → **styled SVG** in the Amber-Glass palette: either **QGIS Print Layout → Export SVG** (each layer becomes an SVG `<g>` group) **or** programmatically with **d3-geo** (`geoMercator`/`geoIdentity` + `geoPath`) / **geojson2svg**.
- Enhance with **AI-generated vector art**: **Recraft V4 Vector** (native SVG, no tracing) for **bespoke per-stage icons**, POI icons, tree/forest motifs, a compass rose, glass textures. Hand-polish in **Figma/Illustrator** (+ **SVGO** to optimize).

**Bonus — georeference comes for free.** Because Layer A is built from a real map projection, the **SVG↔GPS transform is exact and known** (the projection *is* the transform) — it folds straight into DEC-030's `geoToSvg(lng,lat)`, no GCP guessing needed.

### 8.3 Where a satellite/aerial image still helps (optional, reference only)
A designer may underlay a **license-clean** aerial (**Esri/Bing/OpenAerialMap — never Google**) just to *verify* shapes/placement, or run a licensed aerial through **VTracer** to get rough organic contours (tree-mass / water-edge) as a sketch to clean up. Usually unnecessary, since OSM already provides those as vectors.

### 8.4 Concrete steps (the spike)

> ✅ **Built & validated 2026-06-23** — `FestPilot/spikes/map-svg/` runs steps 2–8 end-to-end for De
> Schorre: Overpass→GeoJSON→classified layers→Amber-Glass SVG→stages overlaid→affine exported
> (**residual ≈0.007 px**). Outputs `out/desschorre-base.svg`, `out/viewer.html` (live dots via the
> 6 coefficients), `out/transform.json`. See the spike README for the gotchas it bakes in.

1. Define venue **bbox** (De Schorre, Boom) + target SVG canvas size.
2. **Overpass** query → GeoJSON: lake (water), woods/green, paths, parking, park outline, roads.
3. **Project + render** to a layered SVG (QGIS print layout, or d3-geo + geojson2svg) — one `<g>` per layer.
4. Apply **Amber-Glass styling** (fills/strokes/subtle glass) in code or Figma/Illustrator.
5. **Recraft V4 Vector** → bespoke stage/POI icons + decor → drop into the SVG icon layer.
6. Place **stage + POI markers** at real coords via the same projection (KML seed).
7. Record the projection params as the **affine coefficients** (DEC-030) → runtime `geoToSvg`.
8. **Hand-finish + SVGO**, then bundle/cache for offline (§5).

### 8.5 AI's real role (summary)
- **Recraft V4 Vector** → bespoke **icons + decorative art** (native SVG, no tracing). *This is "our AI" for the map art.*
- **A vision-LLM (Groq / Gemini / etc.)** → optional helper to auto-label / sanity-check placement — **not** to author the map.
- **VTracer** → optional fallback to trace a *license-clean* aerial into rough contours.
- **Not Google imagery, ever** (ToS §21). The accurate geometry comes from **OSM**, not from an AI reading a photo.

## 9. References
- Georeferencing & affine from GCPs: rasterio docs; Felt "what's georeferencing"; scikit-image `estimate_transform`.
- MapLibre `ImageSource` (4-corner overlay), Allmaps `WarpedMapLayer`, PMTiles offline plugin.
- Festival-app patterns (Frontstage, FindTribe, RaveMate, Totem): offline cached interactive map, private opt-in friend location, drop pins/meeting points, walking directions between stages, battery-optimized — matches our plan.
- **Asset pipeline (§8):** OSM→GeoJSON (Overpass, QGIS QuickOSM, `osmtogeojson`); GeoJSON→SVG (QGIS Print Layout, d3-geo `geoPath`, `geojson2svg`); raster→vector tracing (VTracer / Vision Cortex, Potrace); native AI vector (**Recraft V4 Vector** — only model that emits true SVG); **Google Maps ToS §21** (no tracing/derivative works — use Esri/Bing/OpenAerialMap for any imagery tracing); OSM license = **ODbL** (attribution).

## 10. Making it *beautiful* — matching the official illustrated maps (Julio's follow-up)

> Follow-up 2026-06-23: the base SVG from §8 / the `map-svg` spike is **accurate but not yet beautiful**.
> Julio's bar is the **official Tomorrowland maps** (he sent 4 references: **2022** flat-illustrated top-down;
> **2025** photoreal 3D render; the botanical **"Floorplan & Timetable"**; the **Dreamville** master map).
> Goal: an **automated** pipeline whose output is as gorgeous as those, in the Amber-Glass identity —
> *"the app is beautiful, the map can't be ugly."* Researched the real production methods + open data + AI.

### 10.1 How the official / pro maps are actually made (copy the *method*, not the photo)
They are **illustrated / 3D-rendered by artists**, not auto-generated. Confirmed by production write-ups:
- **Rock in Rio 2024** map: build a **3D model**, then **volume → texture → lighting → shadow** passes (3D-assisted illustration).
- **Lightning in a Bottle**: **drone photography → 3D-model-based imagery / digital illustration**.
- **Tomorrowland**: in-house creative team turning each year's theme into bespoke art.
- The constant recipe: **(1) accurate geo base → (2) 3D massing + relief → (3) art passes (texture, light, props) → (4) labels/legend on top.**
- Implication: we can't one-click their result, but we **can automate steps 1–3** and reserve a thin human/AI polish for the "wow". Our edge: only **one map per venue**, re-touched rarely (§8.0), so a careful pipeline is affordable.

### 10.2 The three things that make those maps feel "alive" (each obtainable automatically)
1. **Terrain relief — the single biggest win.** De Schorre is a **former clay quarry**: real hills, an amphitheatre bowl, the lake basin. Flat fills look dead; **shaded relief** is what makes the official map read as a *place*. → **Flanders DHMV-II LiDAR, 1 m DSM/DTM** (open data, free reuse) gives *real* elevation for exactly this site; render **hillshade** (`gdaldem hillshade`) and drape it under the art. (Elsewhere, prettymaps' SRTM-30 m hillshade is the generic fallback; for De Schorre we have **1 m** — far better.)
2. **Texture & density, not flat vector.** Tree **masses drawn as many little trees**, paper/canvas grain, painterly water with a shoreline, soft drop-shadows. → procedurally **scatter tree/POI sprites** on `natural=wood` / `leisure=park` polygons; add **paper-grain + soft shadows** (SVG filters / raster comp). This is the look of the **2022 + Floorplan** references and is fully deterministic.
3. **Bespoke art & props.** Custom **stage icons**, landmark illustrations (the Floorplan map's "tree of life"), an **ornate frame**, a clean legend. → **Recraft V4 Vector** (native SVG) for icons/props; diffusion for background textures (Route B). Hand-finish in Figma.

### 10.3 Legal unlock — we CAN use a real aerial here (just not Google)
§8.1 ruled out **Google** (ToS forbids derivatives). But De Schorre sits in Flanders, which publishes **license-clean** data:
- **Flanders Orthofotomozaïek** — **15 cm** winter aerial, **"Modellicentie voor gratis hergebruik"** (free-reuse model licence), via WMS/WMTS (`https://geo.api.vlaanderen.be/OMWRGBMRVL/wmts`). **Legally reusable** as a texture/reference **and as the conditioning image for AI stylization.**
- **DHMV-II LiDAR 1 m DSM/DTM** — open data, GeoTIFF (EPSG:31370), via EODaS OpenLiDAR download or WMS/WCS — for the relief.
- So Julio's "take the real satellite and make it beautiful" instinct **is viable** — using the **Flemish-government orthophoto**, not Google.

### 10.4 Three automated routes to beauty (pick a tier; all share the same geo base + DEC-030 transform)

> ✅ **Route A built & validated 2026-06-23** — `FestPilot/spikes/map-art/` renders a genuinely
> beautiful illustrated De Schorre from the `map-svg` geo base, fully automated, in **~10 s**.
> What landed: **real terrain relief** (the Mainstage amphitheatre bowl + quarry hills read clearly),
> a **2.5-D scattered tree canopy** (~3.3 k painter-ordered sprites + tonal under-masses), **luminous
> water** with shoreline/sheen, **golden-hour light**, soft shadows, an **ornate amber frame + legend +
> compass**, and **two palettes** (`desschorre-art.png` = on-brand twilight; `-day.png` = bright, ≈ the
> official 2022/Floorplan look). Georeference preserved (viewer.html drops live dots via the affine).
> **Key correction to the plan:** we did **not** need GDAL — Flanders already publishes a **pre-rendered
> hillshade** (`DHMV_II_HILL_25cm`) we pull straight from **WMS** (EPSG:3857, same projection as the map)
> and drape via two `feColorMatrix` relief filters (transparent on flat ground, darkening shadow slopes /
> warming lit ones). See the spike README for gotchas (undici hangs on that WMS → fetch via `curl`).

**Route A — Stylized illustrated cartography  ✅ RECOMMENDED NOW (built).**
Upgrade the existing `map-svg` spike: **LiDAR hillshade** underlay + **textured fills** (paper grain, painterly water) + **scattered tree sprites** + soft shadows + **bespoke Recraft icons** + ornate frame/legend. Output = a gorgeous **2.5D illustrated** map ≈ the **2022 / Floorplan** references. **Deterministic, georeferenced (affine already fitted), light, offline-friendly, 100 % ours, scales to any festival.** Beauty ceiling: high; effort: moderate.

**Route B — AI-painted skin, geometry-locked  (optional "wow" pass).**
Feed **our Route-A render (or the Flanders orthophoto) as a ControlNet conditioning image** (segmentation / depth-from-LiDAR / canny) into **SDXL/Flux + ControlNet** with a painterly prompt/LoRA → a hand-painted look **with geometry preserved** (ControlNet locks composition — proven by **Cartographic-ControlNet**, paper Aug 2025, and **map-sat / ControlEarth** OSM↔satellite). **Never bake labels/pins** — they stay the live vector overlay (DEC-030). Beauty ceiling: very high / painterly; cost: GPU + per-festival prompt tuning; less deterministic.

**Route C — True 3D render  (high-end future = the 2025 map).**
**blosm** (Blender-OSM, scriptable via `bpy.ops.blosm.import_data()`) imports OSM buildings + **forests/trees** and drapes everything on the **DHMV terrain**; add a water shader + **3D stage models**; **top-down orthographic** camera + lighting + post → render a high-res raster; overlay vector labels (georef via the known ortho camera). Beauty ceiling: highest (photoreal/painterly 3D); effort: high (3D assets, GPU/render time).

### 10.5 Recommendation & phasing
- **Now → Route A. ✅ DONE** (`spikes/map-art`). Reuses everything we built, fully automated + georeferenced, ships an unmistakably *beautiful* on-brand map; the **DHMV LiDAR relief alone** closed most of the gap to the official maps. Delivered:
  1. **Relief underlay** from **DHMV-II HILL 25 cm** (pre-rendered hillshade via WMS — *no GDAL needed*), draped with shadow/light `feColorMatrix` filters, clipped to the venue.
  2. **Tree-sprite scatter** on `wood`/`park` polygons (jittered grid, point-in-polygon, painter-ordered) + big "feature" trees + soft tonal under-masses; lawns/water/parking left as clearings.
  3. **Painterly water** (gradient + ripple displacement + shoreline + glow), **paper grain**, **soft shadows**, **golden-hour** wash, venue **focus veil** + amber edge halo.
  4. **Ornate frame + legend + compass + title**, real **Oswald/Albert Sans** baked into the PNG, **bespoke amber stage medallions**, and **two palettes** (twilight / day).
  *Remaining optional polish:* bespoke per-stage icons (Recraft), production SVG that references the hillshade as a file instead of an inline data-URI (the spike inlines it → 4.5 MB `.svg`).
  Keep the affine + presence overlay intact.
- **Practical ceiling reached for on-device generation.** With our **local toolchain** (Node + resvg; no Blender, no GPU), Route A is the realistic max. Going further (painterly **Route B** / 3D **Route C**) needs **external GPU/services** (SDXL+ControlNet or Blender render farm) — a deliberate production step, not a local one.
- **Then → Route B** as an optional **art skin** over Route A's locked geometry, when we want the painterly TML feel without an illustrator per festival.
- **Later → Route C** for a flagship venue if we want the full 2025-grade 3D showpiece.
- **Hard rule (unchanged):** labels, pins, friends, meeting points are **always a live vector/interactive layer** on top of whatever base we pick — beauty never costs us interactivity or the realtime overlay (DEC-030).
- **"Groq" clarification (closes the recurring question):** Groq = fast **LLM** inference (text/vision) — it can't paint or emit a map. The image AI that helps is **diffusion + ControlNet** (Route B skin) and **Recraft V4 Vector** (icons). Accurate shape always comes from **OSM + LiDAR**, never from an AI reading a photo.

### 10.7 Beauty pass 2 (2026-06-23, "don't stop until the ceiling") — what landed
Pushing Route A to its realistic local max, on top of §10.4:
- **Illuminated 2.5-D stage medallions** — pedestal shadow → amber glow → disc → ink rim → inner rim-light → star → top gloss; **needs-review** pins render dashed/muted (admin signal). Reads on **both** palettes.
- **8-point compass rose** (lit/shadow halves) + a **title flourish** (rule–diamond–rule) = proper festival-map chrome.
- **Dual palette is now first-class**: every run ships **twilight + day** as **both `.svg` and `.png`**; the viewer **auto-switches by local time** with a **manual Auto/Day/Night** toggle (§11.5).
- **Deep-zoom proven**: the shipped **SVG is vector**, so at ≈10× zoom the markers/labels/trees/paths/shoreline stay razor-crisp (verified by rendering the SVG at 4800 px and cropping) — exactly what "find my friend" zoom needs. Only the relief underlay softens (it's atmosphere).
- **Relief is pluggable + sized for zoom**: `relief: "auto"` picks **Flanders DHMV-II hillshade** (now **3072 px** for the flagship) where available, else a **global** provider (AWS terrain tiles → JS hillshade) so **any venue on Earth** gets relief; width is configurable (`reliefWidth`).
- **The whole thing is now a one-call generator** (`generateMap(input, outDir)`) — see **§11**.

### 10.6 References (§10)
- **prettymaps** (12k★, AGPL-3.0) — artistic OSM maps (osmnx + matplotlib + shapely); built-in **hillshade** (SRTM) + **keypoints** + presets; PNG/SVG export. *Used as method/inspiration & optional offline build tool — our renderer stays independent to avoid AGPL coupling in the app.*
- **blosm / blender-osm** (`vvoovv/blosm`) — scriptable OSM→3D: buildings, **forests & single trees**, **30 m terrain**, water, roads; Python-driven (`bpy`). Free base + Pro.
- **Cartographic-ControlNet** (claudaff, *Generative AI in Map-Making*, Aug 2025) + **map-sat / ControlEarth** (`miquel-espinosa/map-sat`, HF `controlearth`) — diffusion **conditioned on vector/OSM** → styled map / satellite with **locked geometry** (the Route-B technique).
- **Flanders DHMV-II LiDAR 1 m DSM/DTM** — open data, EODaS OpenLiDAR (`remotesensing.vlaanderen.be/apps/openlidar/`), GeoTIFF EPSG:31370; relief via `gdaldem hillshade`.
- **Flanders Orthofotomozaïek** 15 cm — **free-reuse model licence**, WMS/WMTS `geo.api.vlaanderen.be/OMWRGBMRVL/wmts` — license-clean aerial texture/conditioning (the legal alternative to Google).
- **Pro map-making method** — Rock in Rio 2024 (3D model + texture/light/shadow passes), Lightning in a Bottle (drone + 3D + digital illustration), illustrated-map process guides (research → composition → palette → spot illustrations).

## 11. The productized generator + admin map-editor workflow (Julio's "make this a real system")

> 2026-06-23: Julio's directive — *"all this process you just did, turn it into a real function/system: in the admin website I drop where each stage is and it creates exactly this, for any festival, any location. This is mandatory."* Done: the spike is no longer a one-off script, it's a **reusable engine** (`spikes/map-art/`, standalone — no dependency on `map-svg`). Below is the contract the **admin map-editor** will call.

### 11.1 One call in, the whole beautiful map out
`generateMap(input, outDir) → { scene, files }` (`spikes/map-art/src/generate.ts`). Give it a venue + stage pins; it derives **everything else** and writes the finished, georeferenced map. Same code path for **any festival, any location** — De Schorre is just the default demo (`npm start`), and `config/red-rocks-demo.json` proves a non-Flanders venue.

### 11.2 Input contract (`MapInput`, `src/types.ts`) — this is all the admin produces
- `festivalId` — stable id (filenames / D1 key).
- `title`, `subtitle?` — the map's big title + overline.
- `stages[]` — `{ name, lng, lat, matched? }`. **These pins are the only spatial input**, and they **double as the GCPs** for the affine (DEC-030). `matched:false` ⇒ rendered as a dashed "needs-review" pin.
- `bbox?` / `padMeters?` — explicit extent, or auto-derived as a snug box around the pin cluster (default 220 m pad).
- `relief?` — `"auto"` (default) | `"flanders"` | `"global"` | `"none"`. `reliefWidth?` — hillshade px (default 2048; flagship uses 3072).
- `canvas?` / `scale?` — SVG design size (auto-fit to bbox aspect) + PNG supersample (default 2). The shipped asset is the **vector SVG**, so canvas is just the design space.

### 11.3 What it derives automatically (the pipeline, end-to-end)
1. **Extent** — bbox from the stage cluster (+pad) unless given.
2. **Projection** — fit `d3-geo` `geoMercator` to a snug canvas (aspect from the bbox; no letterboxing).
3. **Geometry** — query **Overpass/OSM** (ODbL) for water/wood/grass/parking/park + roads/paths (cached to `osm-<id>.json`), classify, project to pixels.
4. **Transform** — fit the **affine** from the stages (GPS→SVG), record residual px → `…-transform.json` (the runtime `geoToSvg`).
5. **Relief** — auto-pick provider (Flanders LiDAR hillshade via WMS, else global AWS terrain tiles → JS hillshade), drape under the art (cached `relief-*.png`).
6. **Canopy** — deterministic seeded tree scatter on wood/park polygons (painter-ordered) + tonal under-masses.
7. **Render** — `buildArtSvg` twice (twilight + day) → write **`.svg` ×2**, **`.png` ×2**, `…-transform.json`, `…-viewer.html`.

### 11.4 Outputs (per festival)
| file | role |
|---|---|
| `<id>.svg`, `<id>-day.svg` | **shipped deep-zoom assets** (vector; twilight + day) |
| `<id>.png`, `<id>-day.png` | preview rasters (supersampled) |
| `<id>-transform.json` | the **6 affine coefficients** + bbox + residual → runtime `geoToSvg` |
| `<id>-viewer.html` | demo: day/night toggle + live GPS dots through the transform |

### 11.5 Day / night (Julio's "keep both, auto-switch, let the user override")
Both palettes are generated every run; **selection is an app concern, not a re-generation**: default **Auto** picks day vs. twilight by **local time** (day 07:00–19:00), and the user can force **Day** / **Night**. The shipped `…-viewer.html` already demonstrates exactly this (segmented control + auto-by-clock). In the PWA this is the same toggle in map settings (§7), swapping which SVG layer is shown; the live overlay (friends/pins) is unaffected.

### 11.6 Relief for *any* venue
`auto` keeps De Schorre/Tomorrowland on the best source (**Flanders DHMV-II 25 cm hillshade**, EPSG:3857 WMS — same projection as the map, no GDAL), and **everywhere else** falls back to **AWS Open Terrain Tiles** (terrarium PNG, worldwide, no key) which we stitch + hillshade in JS. So the admin never has to think about terrain — it just works, globally. (`src/relief.ts`.)

### 11.7 Admin map-editor workflow (the product around the engine)
Julio's insight: **stage *placement* accuracy is an admin-UI problem, not a generation problem** (Google's own pins are sometimes off). So the admin tool owns precise placement; the generator owns beauty + georeference.
1. **Admin opens "New / Edit festival"** (desktop web). Enters `festivalId`, `title`, `subtitle`.
2. **Drops/drags stage pins** on a **plain reference base map** (Google/Mapbox/Leaflet used **only for placement reference — never traced or baked**, DEC-031) and types each stage name. Drag = fix position; mark each **verified** (`matched:true`).
3. **Save** ⇒ serializes exactly a `MapInput` (the pins are the GCPs).
4. **Generate** ⇒ backend runs `generateMap` (a **Worker job / queue**, since Overpass + relief are network + CPU). Stores the SVGs + `transform.json` in **R2/D1** keyed by `festivalId`.
5. **Admin previews** the returned map (day/night), nudges any pin, re-generates until happy.
6. **App** loads the `festivalId` asset bundle (SVG + transform + POIs) for offline use (§5). Re-touch only when stages move (§8.0).
- Terrain editing (add/remove trees, carve land) is **deliberately out of scope** — Julio: *"leave it automatic, it complicates more than it's worth; the map already looks great."*

### 11.8 Production notes (carry over from the spike)
- **Deep zoom** = ship the **vector SVG** (crisp at any zoom) and/or pre-bake a **raster tile pyramid**; don't rasterize giant PNGs per request (a 4800 px render of the tree-dense SVG takes ~100 s — fine offline, not per-request).
- **Slim the asset**: the spike **inlines** the relief as a base64 data-URI (→ ~17–28 MB `.svg`). In prod, reference the hillshade as an **external file/tiles** so the SVG is small and the relief can stream/upgrade with zoom.
- **Be kind to Overpass**: cache per festival, retry mirrors, regenerate rarely (the venue is static).
- **WMS gotcha** (baked into the spike): Node's `fetch`/undici **hangs** on the Flanders WMS → we fetch via **`curl`** (`src/http.ts`). Keep that in the Worker port (or use a fetch with an explicit Agent/timeout).
- **Where it runs**: generation is a **build/admin-time job**, not app runtime — exactly the §8.0 framing.
