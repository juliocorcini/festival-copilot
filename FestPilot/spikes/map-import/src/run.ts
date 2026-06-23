// Spike runner: parse the seeded KML, auto-match official stages, report, and emit
// an offline admin "verify" map (out/admin-verify.html) + out/imported-features.json.
//
// Run: npm start   (tsx src/run.ts)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseKml } from "./kml.js";
import { matchFeatures } from "./match.js";
import type { ImportedMapFeature, OfficialStage } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, "..", "fixtures");
const OUT = path.join(here, "..", "out");
fs.mkdirSync(OUT, { recursive: true });

const line = (s = "") => console.log(s);
const h = (s: string) => line(`\n${"=".repeat(3)} ${s} ${"=".repeat(Math.max(0, 58 - s.length))}`);

// 1) PARSE
const kml = fs.readFileSync(path.join(FIX, "tml-22-dreamland.kml"), "utf-8");
const features = parseKml(kml);
h("1. PARSE KML");
const byType = features.reduce<Record<string, number>>((acc, f) => {
  acc[f.geometry.type] = (acc[f.geometry.type] ?? 0) + 1;
  return acc;
}, {});
line(`features: ${features.length}  (${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(", ")})`);

// 2) MATCH against the official lineup stages
const stagesRaw = JSON.parse(fs.readFileSync(path.join(FIX, "official-stages.json"), "utf-8"));
const official: OfficialStage[] = stagesRaw.stages.map((s: any) => ({ id: String(s.id), name: String(s.name) }));
const { features: mapped, officialUnplaced } = matchFeatures(features, official);

h("2. AUTO-MATCH stages");
const matched = mapped.filter((f) => f.status === "matched");
line(`official stages: ${official.length}   matched from KML: ${matched.length}`);
line("");
for (const f of matched.sort((a, b) => a.matchedStageName!.localeCompare(b.matchedStageName!))) {
  const [lng, lat] = (f.geometry as { coordinates: [number, number] }).coordinates;
  line(`  ✓ ${f.name.padEnd(16)} -> ${f.matchedStageName!.padEnd(22)} (${f.matchConfidence}) @ ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
}

h("3. NEEDS REVIEW (point looks like a stage, no match -> likely old/renamed)");
const review = mapped.filter((f) => f.status === "needs_review");
for (const f of review) line(`  ? ${f.name}`);
if (!review.length) line("  (none)");

h("4. OFFICIAL STAGES WITHOUT A SEED LOCATION (admin must place these)");
for (const s of officialUnplaced) line(`  + ${s.name}`);
if (!officialUnplaced.length) line("  (all official stages have a seed location)");

h("5. OTHER IMPORTED FEATURES (practical layer seed)");
const cat = (c: string) => mapped.filter((f) => f.category === c);
line(`  areas (DreamVille/camping): ${cat("area").length}`);
line(`  entrances:                  ${cat("entrance").length}`);
line(`  paths:                      ${cat("path").length}`);
line(`  other POIs:                 ${cat("poi").filter((f) => f.status !== "needs_review").length}`);

// 3) EMIT outputs
fs.writeFileSync(path.join(OUT, "imported-features.json"), JSON.stringify(mapped, null, 2));
fs.writeFileSync(path.join(OUT, "admin-verify.html"), buildHtml(mapped));
h("OUTPUT");
line(`  out/imported-features.json   (${mapped.length} features)`);
line(`  out/admin-verify.html        (open in a browser to verify on a real map)`);
line("");
line("DONE — KML seed parsed, stages auto-matched, admin map generated.");

// --- admin verify map (self-contained Leaflet page, no server needed) ---
function buildHtml(items: ImportedMapFeature[]): string {
  const colors: Record<string, string> = {
    matched: "#16a34a",
    needs_review: "#f59e0b",
    entrance: "#2563eb",
    area: "#7c3aed",
    path: "#6b7280",
    poi: "#0891b2",
  };
  const colorKey = (f: ImportedMapFeature) =>
    f.status === "matched" ? "matched" : f.status === "needs_review" ? "needs_review" : f.category;

  const fc = {
    type: "FeatureCollection",
    features: items.map((f) => ({
      type: "Feature",
      geometry: f.geometry,
      properties: {
        name: f.name || "(unnamed)",
        category: f.category,
        status: f.status,
        matched: f.matchedStageName,
        confidence: f.matchConfidence,
        color: colors[colorKey(f)] ?? "#0891b2",
      },
    })),
  };

  const legend = Object.entries({
    "Matched stage": colors.matched,
    "Needs review": colors.needs_review,
    Entrance: colors.entrance,
    "Area (camping/zone)": colors.area,
    Path: colors.path,
    POI: colors.poi,
  })
    .map(([label, c]) => `<div><span style="background:${c}"></span>${label}</div>`)
    .join("");

  return [
    "<!doctype html><html><head><meta charset='utf-8'>",
    "<title>FestPilot — Map seed admin verify</title>",
    "<meta name='viewport' content='width=device-width, initial-scale=1'>",
    "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'>",
    "<style>",
    "html,body{margin:0;height:100%}#map{height:100%}",
    ".legend{position:absolute;z-index:1000;top:10px;right:10px;background:#fff;padding:10px 12px;border-radius:8px;font:13px system-ui;box-shadow:0 1px 6px rgba(0,0,0,.3)}",
    ".legend div{display:flex;align-items:center;gap:8px;margin:3px 0}.legend span{width:14px;height:14px;border-radius:50%;display:inline-block}",
    ".title{position:absolute;z-index:1000;top:10px;left:10px;background:#111;color:#fff;padding:8px 12px;border-radius:8px;font:600 14px system-ui}",
    "</style></head><body>",
    "<div class='title'>FestPilot map seed — verify &amp; set stage radius</div>",
    `<div class='legend'>${legend}</div>`,
    "<div id='map'></div>",
    "<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></script>",
    "<script>",
    `var DATA = ${JSON.stringify(fc)};`,
    "var map = L.map('map');",
    "L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'&copy; OpenStreetMap'}).addTo(map);",
    "function popup(p){",
    "  var s = '<b>'+p.name+'</b><br>status: '+p.status+'<br>category: '+p.category;",
    "  if(p.matched){ s += '<br>matched: '+p.matched+' ('+p.confidence+')'; }",
    "  s += '<br><i>Admin: confirm location &amp; set radius</i>';",
    "  return s;",
    "}",
    "var layer = L.geoJSON(DATA,{",
    "  style:function(feat){return {color:feat.properties.color,weight:2,fillOpacity:0.15};},",
    "  pointToLayer:function(feat,latlng){return L.circleMarker(latlng,{radius:7,color:feat.properties.color,fillColor:feat.properties.color,fillOpacity:0.9,weight:2});},",
    "  onEachFeature:function(feat,lyr){lyr.bindPopup(popup(feat.properties)); if(feat.properties.status!=='non_stage'){lyr.bindTooltip(feat.properties.name,{permanent:false});}}",
    "}).addTo(map);",
    "try{ map.fitBounds(layer.getBounds(),{padding:[30,30]}); }catch(e){ map.setView([51.0905,4.384],15); }",
    "</script></body></html>",
  ].join("\n");
}
