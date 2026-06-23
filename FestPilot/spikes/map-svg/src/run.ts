/**
 * FestPilot map-svg spike (DEC-031).
 *
 * Pipeline: OpenStreetMap (Overpass, ODbL) -> GeoJSON -> stylized Amber-Glass SVG,
 * overlay the seeded/verified stage points (DEC-021), and fit + export the
 * GPS->SVG affine transform (DEC-030). Outputs an interactive viewer that drops a
 * live "you are here" + friends using only the exported 6 coefficients.
 *
 * Run: npm start
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import osmtogeojson from "osmtogeojson";
import { buildQuery, fetchOverpass, type BBox } from "./overpass.js";
import { fitAffine, residual, type GeoPoint, type PixelPoint } from "./affine.js";
import { render, svgDocument, type StagePoint } from "./render.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "out");
const STAGES_PATH = join(HERE, "..", "..", "map-import", "out", "imported-features.json");

const WIDTH = 880;
const HEIGHT = 1180;
const PAD_LAT = 0.0020; // ~220 m north/south around the stage cluster
const PAD_LNG = 0.0032; // ~225 m east/west (cos(51°) ≈ 0.63)

interface ImportedFeature {
  name: string;
  category: string;
  status: string;
  matchedStageName: string | null;
  geometry: { type: string; coordinates: [number, number] } | null;
}

function loadStages(): StagePoint[] {
  const raw = JSON.parse(readFileSync(STAGES_PATH, "utf8")) as ImportedFeature[];
  return raw
    .filter((f) => f.category === "stage" && f.geometry?.type === "Point")
    .map((f) => ({
      name: f.matchedStageName ?? f.name,
      lng: f.geometry!.coordinates[0],
      lat: f.geometry!.coordinates[1],
      matched: f.status === "matched",
    }));
}

/**
 * Fit object for the projection: the four bbox corners as a MultiPoint.
 * (A Polygon would trigger d3-geo's spherical winding rule and be read as
 * covering the whole globe, collapsing the projection to a single point.)
 */
function bboxCorners(b: BBox): unknown {
  return {
    type: "MultiPoint",
    coordinates: [
      [b.west, b.south],
      [b.east, b.south],
      [b.east, b.north],
      [b.west, b.north],
    ],
  };
}

interface SaneBounds {
  w: number;
  e: number;
  s: number;
  n: number;
}

/** True only if every coordinate of the geometry sits within the sane bounds. */
function coordsWithin(geometry: unknown, b: SaneBounds): boolean {
  const g = geometry as { coordinates?: unknown } | null;
  if (!g?.coordinates) return false;
  let ok = true;
  const walk = (node: unknown): void => {
    if (!ok || !Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      const lng = node[0];
      const lat = node[1];
      if (lng < b.w || lng > b.e || lat < b.s || lat > b.n) ok = false;
      return;
    }
    for (const child of node) walk(child);
  };
  walk(g.coordinates);
  return ok;
}

async function main(): Promise<void> {
  console.log("FestPilot map-svg spike — OSM -> Amber-Glass SVG + GPS transform\n");
  mkdirSync(OUT_DIR, { recursive: true });

  const stages = loadStages();
  if (stages.length < 3) throw new Error(`Need >=3 stage control points, got ${stages.length}`);
  console.log(`  stages (control points): ${stages.length}`);

  const lngs = stages.map((s) => s.lng);
  const lats = stages.map((s) => s.lat);
  const bbox: BBox = {
    west: Math.min(...lngs) - PAD_LNG,
    east: Math.max(...lngs) + PAD_LNG,
    south: Math.min(...lats) - PAD_LAT,
    north: Math.max(...lats) + PAD_LAT,
  };
  console.log(`  bbox: S=${bbox.south.toFixed(5)} W=${bbox.west.toFixed(5)} N=${bbox.north.toFixed(5)} E=${bbox.east.toFixed(5)}`);

  // Cache the raw OSM response so we can iterate on rendering offline (and to be
  // polite to Overpass). Set REFRESH=1 to refetch.
  const rawPath = join(OUT_DIR, "osm-raw.json");
  let osm: unknown;
  if (existsSync(rawPath) && !process.env["REFRESH"]) {
    console.log("  using cached OSM (out/osm-raw.json; REFRESH=1 to refetch)");
    osm = JSON.parse(readFileSync(rawPath, "utf8"));
  } else {
    console.log("  querying Overpass (OSM, ODbL) …");
    osm = await fetchOverpass(buildQuery(bbox));
    writeFileSync(rawPath, JSON.stringify(osm));
  }
  const geo = osmtogeojson(osm);
  console.log(`  OSM features: ${geo.features.length}`);

  // Drop features with coordinates far outside the venue. Relations/multipolygons
  // partly outside the bbox can resolve missing nodes to (0,0), producing giant
  // polygons that (once clipped to the frame) smear across the whole map.
  const sane = { w: bbox.west - 0.2, e: bbox.east + 0.2, s: bbox.south - 0.2, n: bbox.north + 0.2 };
  const before = geo.features.length;
  geo.features = geo.features.filter((f) => coordsWithin(f.geometry, sane));
  console.log(`  sane features (dropped ${before - geo.features.length} out-of-area): ${geo.features.length}`);

  const { inner, projection, counts } = render(geo, bboxCorners(bbox), stages, WIDTH, HEIGHT);
  console.log(`  drawn by layer: ${JSON.stringify(counts)}`);

  // Fit the GPS->SVG affine from the projected stage control points.
  const src: GeoPoint[] = stages.map((s) => ({ lng: s.lng, lat: s.lat }));
  const dst: PixelPoint[] = stages.map((s) => {
    const xy = projection([s.lng, s.lat])!;
    return { x: xy[0], y: xy[1] };
  });
  const transform = fitAffine(src, dst);
  const res = residual(transform, src, dst);
  console.log(`  affine residual vs projection: max=${res.maxPx.toFixed(3)}px mean=${res.meanPx.toFixed(3)}px`);

  // Write outputs.
  const svg = svgDocument(WIDTH, HEIGHT, inner);
  writeFileSync(join(OUT_DIR, "desschorre-base.svg"), svg);
  writeFileSync(join(OUT_DIR, "desschorre.geojson"), JSON.stringify(geo));
  writeFileSync(
    join(OUT_DIR, "transform.json"),
    JSON.stringify(
      {
        festival: "tomorrowland-2026",
        venue: "De Schorre, Boom (BE)",
        canvas: { width: WIDTH, height: HEIGHT },
        bbox,
        affine: transform,
        residualPx: res,
        note: "x = a*lng + b*lat + c ; y = d*lng + e*lat + f. Apply at runtime as geoToSvg(lng,lat).",
        source: "OpenStreetMap contributors (ODbL)",
      },
      null,
      2,
    ),
  );
  writeFileSync(join(OUT_DIR, "viewer.html"), viewer(svg, transform, stages));

  console.log(`\n  wrote out/desschorre-base.svg, out/viewer.html, out/transform.json, out/desschorre.geojson`);
  console.log("  open out/viewer.html to see the base map + live dots placed via the transform.\n");
}

function viewer(svg: string, t: ReturnType<typeof fitAffine>, stages: StagePoint[]): string {
  // Demo live points: "me" at the stage centroid, two friends + a meeting point on real stages.
  const cx = stages.reduce((s, p) => s + p.lng, 0) / stages.length;
  const cy = stages.reduce((s, p) => s + p.lat, 0) / stages.length;
  const tests = [
    { lng: cx, lat: cy, kind: "me", label: "You" },
    ...(stages[0] ? [{ lng: stages[0].lng, lat: stages[0].lat, kind: "friend", label: "Andy" }] : []),
    ...(stages[3] ? [{ lng: stages[3].lng, lat: stages[3].lat, kind: "friend", label: "Mia" }] : []),
    ...(stages[6] ? [{ lng: stages[6].lng, lat: stages[6].lat, kind: "meet", label: "Meet" }] : []),
  ];
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>FestPilot — De Schorre base map (OSM -> SVG spike)</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Albert+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:#08070a;color:#F5F0E6;font-family:"Albert Sans",system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;gap:14px;padding:24px}
  h1{font-family:"Oswald",sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:20px;margin:0}
  .wrap{position:relative;width:min(92vw,520px)}
  .wrap svg{width:100%;height:auto;display:block;border-radius:22px;box-shadow:0 40px 90px -30px rgba(245,166,35,.3)}
  .legend{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;font-size:12px;color:#cbb78e}
  .legend b{color:#FFD060}
  .att{font-size:11px;color:#7c715f;max-width:520px;text-align:center}
  text{font-family:"Oswald",sans-serif}
  .pulse{animation:p 1.8s ease-out infinite}
  @keyframes p{0%{r:6;opacity:.55}100%{r:22;opacity:0}}
</style></head>
<body>
  <h1>De Schorre — base map (OSM → SVG spike)</h1>
  <div class="legend">
    <span><b>●</b> stage (matched)</span>
    <span><b>◌</b> stage (needs review)</span>
    <span><b style="color:#5ad1ff">●</b> you / friends (placed via affine transform)</span>
  </div>
  <div class="wrap">
    ${svg}
  </div>
  <p class="att">Base geometry © OpenStreetMap contributors (ODbL). Live dots are positioned at real GPS coordinates using only the 6 exported affine coefficients (geoToSvg), proving the GPS→SVG round-trip on real data.</p>
<script>
  const T = ${JSON.stringify(t)};
  const TESTS = ${JSON.stringify(tests)};
  const NS = "http://www.w3.org/2000/svg";
  function geoToSvg(lng, lat){ return [T.a*lng + T.b*lat + T.c, T.d*lng + T.e*lat + T.f]; }
  const live = document.getElementById("live");
  const COLORS = { me:"#5ad1ff", friend:"#7CF59A", meet:"#F5A623" };
  for (const p of TESTS){
    const [x,y] = geoToSvg(p.lng, p.lat);
    const color = COLORS[p.kind] || "#5ad1ff";
    const ring = document.createElementNS(NS,"circle");
    ring.setAttribute("cx",x); ring.setAttribute("cy",y); ring.setAttribute("r","6");
    ring.setAttribute("fill",color); ring.setAttribute("class","pulse"); ring.style.color=color;
    const dot = document.createElementNS(NS,"circle");
    dot.setAttribute("cx",x); dot.setAttribute("cy",y); dot.setAttribute("r","5");
    dot.setAttribute("fill",color); dot.setAttribute("stroke","#08070a"); dot.setAttribute("stroke-width","2");
    const tx = document.createElementNS(NS,"text");
    tx.setAttribute("x", x); tx.setAttribute("y", y-10); tx.setAttribute("text-anchor","middle");
    tx.setAttribute("font-size","11"); tx.setAttribute("font-weight","700"); tx.setAttribute("fill",color);
    tx.setAttribute("stroke","#08070a"); tx.setAttribute("stroke-width","3"); tx.setAttribute("paint-order","stroke");
    tx.textContent = p.label;
    live.appendChild(ring); live.appendChild(dot); live.appendChild(tx);
  }
</script>
</body></html>`;
}

main().catch((e) => {
  console.error("\nSpike failed:", e);
  process.exit(1);
});
