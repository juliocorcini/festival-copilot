/**
 * GeoJSON -> stylized Amber-Glass SVG (DEC-031, layer C).
 * Uses d3-geo to project real lng/lat into the SVG canvas, one <g> per layer.
 */
import { geoMercator, type GeoProjection } from "d3-geo";

export interface StagePoint {
  name: string;
  lng: number;
  lat: number;
  matched: boolean;
}

interface FeatureCollection {
  type: "FeatureCollection";
  features: Array<{ properties: Record<string, string> | null; geometry: unknown }>;
}

type LayerKey = "park" | "green" | "water" | "parking" | "building" | "road" | "path";

// Buildings are intentionally excluded: the bbox spills into Boom town (~2600 houses),
// which is noise for a festival map. On-site structures come from the POI layer (DEC-022).
const DRAW_ORDER: LayerKey[] = ["park", "green", "water", "parking", "road", "path"];

const LAYER_STYLE: Record<LayerKey, string> = {
  park: 'fill="#181308" fill-rule="evenodd" stroke="rgba(245,166,35,.22)" stroke-width="1.4"',
  green: 'fill="rgba(120,150,70,.16)" fill-rule="evenodd" stroke="rgba(120,150,70,.10)" stroke-width="0.6"',
  water: 'fill="url(#water)" fill-rule="evenodd" stroke="rgba(150,200,235,.45)" stroke-width="1.3"',
  parking: 'fill="rgba(255,255,255,.03)" fill-rule="evenodd" stroke="rgba(255,255,255,.05)" stroke-width="0.7"',
  building: 'fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.06)" stroke-width="0.6"',
  road: 'fill="none" stroke="rgba(232,214,176,.26)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"',
  path: 'fill="none" stroke="rgba(245,166,35,.30)" stroke-width="1.2" stroke-dasharray="1 4" stroke-linecap="round"',
};

function classify(p: Record<string, string> | null): LayerKey | undefined {
  if (!p) return undefined;
  if (p["waterway"]) return undefined; // streams / riverbanks (lines) — skip
  if (p["natural"] === "water" || p["water"]) {
    if (p["water"] === "river" || p["water"] === "canal") return undefined; // the tidal Rupel etc. (outside venue)
    return "water";
  }
  if (p["amenity"] === "parking" || p["landuse"] === "parking") return "parking";
  if (p["building"]) return undefined; // excluded — see DRAW_ORDER note
  if (p["highway"]) {
    return /^(footway|path|track|pedestrian|cycleway|steps)$/.test(p["highway"]) ? "path" : "road";
  }
  if (
    p["natural"] === "wood" || p["natural"] === "scrub" || p["natural"] === "grassland" ||
    p["landuse"] === "forest" || p["landuse"] === "grass" || p["landuse"] === "meadow"
  ) {
    return "green";
  }
  if (p["leisure"] === "park" || p["leisure"] === "nature_reserve" || p["landuse"] === "recreation_ground") {
    return "park";
  }
  return undefined;
}

export interface RenderResult {
  inner: string;
  projection: GeoProjection;
  counts: Record<string, number>;
}

export function render(
  geo: FeatureCollection,
  bboxPolygon: unknown,
  stages: StagePoint[],
  width: number,
  height: number,
): RenderResult {
  const margin = 26;
  const projection = geoMercator().fitExtent(
    [[margin, margin], [width - margin, height - margin]],
    bboxPolygon as Parameters<GeoProjection["fitExtent"]>[1],
  );
  // Build path data by projecting each vertex ourselves (straight segments).
  // We deliberately avoid d3 geoPath here: its spherical polygon handling reads
  // OSM rings with the "wrong" winding as covering the whole globe, producing
  // giant smeared fills. Over a ~1 km site, straight segments are exact.
  const project = (c: number[]): string | null => {
    const xy = projection([c[0] ?? 0, c[1] ?? 0]);
    return xy ? `${xy[0].toFixed(1)},${xy[1].toFixed(1)}` : null;
  };
  const lineD = (coords: number[][]): string => {
    let d = "";
    let first = true;
    for (const c of coords) {
      const s = project(c);
      if (!s) continue;
      d += (first ? "M" : "L") + s;
      first = false;
    }
    return first ? "" : d;
  };
  const ringD = (coords: number[][]): string => {
    const d = lineD(coords);
    return d ? d + "Z" : "";
  };
  const toPath = (geometry: unknown): string => {
    const g = geometry as { type?: string; coordinates?: unknown };
    switch (g.type) {
      case "LineString": return lineD(g.coordinates as number[][]);
      case "MultiLineString": return (g.coordinates as number[][][]).map(lineD).join("");
      case "Polygon": return (g.coordinates as number[][][]).map(ringD).join("");
      case "MultiPolygon": return (g.coordinates as number[][][][]).map((poly) => poly.map(ringD).join("")).join("");
      default: return "";
    }
  };

  const buckets: Record<LayerKey, string[]> = {
    park: [], green: [], water: [], parking: [], building: [], road: [], path: [],
  };
  const counts: Record<string, number> = {};
  const AREA_LAYERS = new Set<LayerKey>(["park", "green", "water", "parking"]);
  const LINE_LAYERS = new Set<LayerKey>(["road", "path"]);

  for (const feature of geo.features) {
    const layer = classify(feature.properties);
    if (!layer) continue;
    // Fill area layers from polygons only; stroke line layers from lines only.
    const gtype = (feature.geometry as { type?: string } | null)?.type ?? "";
    const isPoly = gtype === "Polygon" || gtype === "MultiPolygon";
    const isLine = gtype === "LineString" || gtype === "MultiLineString";
    if (AREA_LAYERS.has(layer) && !isPoly) continue;
    if (LINE_LAYERS.has(layer) && !isLine) continue;
    const d = toPath(feature.geometry);
    if (!d) continue;
    buckets[layer].push(d);
    counts[layer] = (counts[layer] ?? 0) + 1;
  }

  const layerSvg = DRAW_ORDER.map((key) => {
    if (buckets[key].length === 0) return "";
    return `  <g id="layer-${key}" ${LAYER_STYLE[key]}><path d="${buckets[key].join(" ")}"/></g>`;
  }).join("\n");

  const stageSvg = stages
    .map((s) => {
      const xy = projection([s.lng, s.lat]);
      if (!xy) return "";
      const [x, y] = xy;
      const dot = s.matched
        ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="#FFD060" stroke="#0F0D09" stroke-width="2"/>`
        : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5.5" fill="none" stroke="#F5A623" stroke-width="2" stroke-dasharray="2 2"/>`;
      const label = `<text x="${(x + 9).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-size="11" font-weight="700" fill="#F5F0E6" stroke="#0F0D09" stroke-width="2.6" paint-order="stroke" font-family="Oswald, system-ui, sans-serif" style="text-transform:uppercase;letter-spacing:.02em">${escapeXml(s.name)}</text>`;
      return `    ${dot}${label}`;
    })
    .filter(Boolean)
    .join("\n");

  const inner = `  <rect width="${width}" height="${height}" fill="#0F0D09"/>
  <rect width="${width}" height="${height}" fill="url(#vignette)"/>
  <g clip-path="url(#frame)">
${layerSvg}
  </g>
  <g id="layer-stages">
${stageSvg}
  </g>
  <g id="live"></g>`;

  return { inner, projection, counts };
}

export function defs(width: number, height: number): string {
  return `  <defs>
    <clipPath id="frame"><rect x="0" y="0" width="${width}" height="${height}"/></clipPath>
    <radialGradient id="vignette" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="rgba(60,46,20,.35)"/>
      <stop offset="55%" stop-color="rgba(20,16,9,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,.55)"/>
    </radialGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c3850"/>
      <stop offset="100%" stop-color="#122536"/>
    </linearGradient>
  </defs>`;
}

export function svgDocument(width: number, height: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
${defs(width, height)}
${inner}
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (ch) =>
    ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch === "&" ? "&amp;" : ch === "'" ? "&apos;" : "&quot;",
  );
}
