/**
 * Scene builder for the map generator (DEC-033).
 *
 * Standalone: given a MapInput (venue + stage pins), it derives the bbox, fits a
 * Mercator projection to a snug canvas, pulls OSM geometry (Overpass, ODbL),
 * classifies + projects it to pixels, and fits the GPS->SVG affine (DEC-030) from
 * the stages. No dependency on any other spike — works for any festival anywhere.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { geoMercator, type GeoProjection } from "d3-geo";
import osmtogeojson from "osmtogeojson";
import { fitAffine, residual, type Affine, type Residual } from "./affine.js";
import { buildQuery, fetchOverpass } from "./overpass.js";
import type { BBoxLngLat, MapInput, StageInput } from "./types.js";

export type Pt = [number, number];
export type Ring = Pt[];
export type Poly = Ring[];
export type AreaKey = "venue" | "wood" | "grass" | "water" | "parking";
export type LineKey = "road" | "path";

export interface Stage {
  name: string;
  lng: number;
  lat: number;
  matched: boolean;
}

export interface Scene {
  affine: Affine;
  residualPx: Residual;
  width: number;
  height: number;
  bbox: BBoxLngLat;
  areas: Record<AreaKey, Poly[]>;
  lines: Record<LineKey, Ring[]>;
  stages: Stage[];
  attribution: string;
}

interface GeoFeature {
  properties: Record<string, string> | null;
  geometry: { type?: string; coordinates?: unknown } | null;
}

export function geoToXY(t: Affine, lng: number, lat: number): Pt {
  return [t.a * lng + t.b * lat + t.c, t.d * lng + t.e * lat + t.f];
}

// ---- bbox + canvas ---------------------------------------------------------
export function bboxFromStages(stages: StageInput[], padMeters: number): BBoxLngLat {
  const lats = stages.map((s) => s.lat);
  const lngs = stages.map((s) => s.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = padMeters / 111320;
  const dLng = padMeters / (111320 * Math.cos((midLat * Math.PI) / 180));
  return {
    west: Math.min(...lngs) - dLng,
    east: Math.max(...lngs) + dLng,
    south: Math.min(...lats) - dLat,
    north: Math.max(...lats) + dLat,
  };
}

/** Snug canvas whose aspect matches the bbox in Mercator (no letterboxing). */
function fitCanvas(b: BBoxLngLat, width: number): { width: number; height: number } {
  const p = geoMercator().scale(1).translate([0, 0]);
  const nw = p([b.west, b.north])!;
  const se = p([b.east, b.south])!;
  const dx = Math.abs(se[0] - nw[0]);
  const dy = Math.abs(se[1] - nw[1]);
  return { width, height: Math.max(1, Math.round((width * dy) / dx)) };
}

function bboxCorners(b: BBoxLngLat): GeoJSON.MultiPoint {
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

// ---- classification --------------------------------------------------------
function classifyArea(p: Record<string, string> | null): AreaKey | undefined {
  if (!p) return undefined;
  if (p["natural"] === "water" || p["water"]) {
    if (p["water"] === "river" || p["water"] === "canal") return undefined;
    return "water";
  }
  if (p["amenity"] === "parking" || p["landuse"] === "parking") return "parking";
  if (p["natural"] === "wood" || p["landuse"] === "forest" || p["natural"] === "scrub") return "wood";
  if (p["landuse"] === "grass" || p["landuse"] === "meadow" || p["natural"] === "grassland") return "grass";
  if (p["leisure"] === "park" || p["leisure"] === "nature_reserve" || p["landuse"] === "recreation_ground")
    return "venue";
  return undefined;
}
function classifyLine(p: Record<string, string> | null): LineKey | undefined {
  if (!p) return undefined;
  if (p["waterway"]) return undefined;
  if (p["highway"])
    return /^(footway|path|track|pedestrian|cycleway|steps)$/.test(p["highway"]) ? "path" : "road";
  return undefined;
}

function coordsWithin(geometry: unknown, b: BBoxLngLat): boolean {
  const g = geometry as { coordinates?: unknown } | null;
  if (!g?.coordinates) return false;
  let ok = true;
  const walk = (node: unknown): void => {
    if (!ok || !Array.isArray(node)) return;
    if (typeof node[0] === "number" && typeof node[1] === "number") {
      const lng = node[0], lat = node[1];
      if (lng < b.west - 0.2 || lng > b.east + 0.2 || lat < b.south - 0.2 || lat > b.north + 0.2) ok = false;
      return;
    }
    for (const child of node) walk(child);
  };
  walk(g.coordinates);
  return ok;
}

// ---- build -----------------------------------------------------------------
export interface BuildOpts {
  cacheFile?: string;
  refresh?: boolean;
  log?: (m: string) => void;
}

export function buildScene(input: MapInput, opts: BuildOpts = {}): Scene {
  const log = opts.log ?? (() => {});
  const stages: Stage[] = input.stages.map((s) => ({
    name: s.name,
    lng: s.lng,
    lat: s.lat,
    matched: s.matched ?? true,
  }));
  if (stages.length < 3) throw new Error(`Need >=3 stage control points, got ${stages.length}`);

  const bbox = input.bbox ?? bboxFromStages(input.stages, input.padMeters ?? 220);
  const canvas = input.canvas ?? fitCanvas(bbox, 1000);
  const margin = 28;
  const projection: GeoProjection = geoMercator().fitExtent(
    [[margin, margin], [canvas.width - margin, canvas.height - margin]],
    bboxCorners(bbox),
  );
  const project = (c: number[]): Pt => {
    const xy = projection([c[0] ?? 0, c[1] ?? 0]);
    return xy ? [xy[0], xy[1]] : [0, 0];
  };
  const projRing = (coords: number[][]): Ring => coords.map(project);
  const polysOf = (geom: GeoFeature["geometry"]): Poly[] => {
    if (!geom) return [];
    if (geom.type === "Polygon") return [(geom.coordinates as number[][][]).map(projRing)];
    if (geom.type === "MultiPolygon")
      return (geom.coordinates as number[][][][]).map((poly) => poly.map(projRing));
    return [];
  };
  const linesOf = (geom: GeoFeature["geometry"]): Ring[] => {
    if (!geom) return [];
    if (geom.type === "LineString") return [projRing(geom.coordinates as number[][])];
    if (geom.type === "MultiLineString") return (geom.coordinates as number[][][]).map(projRing);
    return [];
  };

  // OSM (cached to disk so we can iterate offline + be kind to Overpass).
  let osm: unknown;
  if (opts.cacheFile && existsSync(opts.cacheFile) && !opts.refresh) {
    log(`  osm: using cache ${opts.cacheFile}`);
    osm = JSON.parse(readFileSync(opts.cacheFile, "utf8"));
  } else {
    log("  osm: querying Overpass (ODbL) …");
    osm = fetchOverpass(buildQuery(bbox));
    if (opts.cacheFile) writeFileSync(opts.cacheFile, JSON.stringify(osm));
  }
  const geo = osmtogeojson(osm);

  const areas: Record<AreaKey, Poly[]> = { venue: [], wood: [], grass: [], water: [], parking: [] };
  const lines: Record<LineKey, Ring[]> = { road: [], path: [] };
  for (const f of geo.features as GeoFeature[]) {
    if (!coordsWithin(f.geometry, bbox)) continue;
    const gtype = f.geometry?.type ?? "";
    if (gtype === "Polygon" || gtype === "MultiPolygon") {
      const key = classifyArea(f.properties);
      if (key) areas[key].push(...polysOf(f.geometry));
    } else if (gtype === "LineString" || gtype === "MultiLineString") {
      const key = classifyLine(f.properties);
      if (key) lines[key].push(...linesOf(f.geometry));
    }
  }

  const src = stages.map((s) => ({ lng: s.lng, lat: s.lat }));
  const dst = stages.map((s) => {
    const xy = projection([s.lng, s.lat])!;
    return { x: xy[0], y: xy[1] };
  });
  const affine = fitAffine(src, dst);
  const res = residual(affine, src, dst);

  return {
    affine,
    residualPx: res,
    width: canvas.width,
    height: canvas.height,
    bbox,
    areas,
    lines,
    stages,
    attribution: "OpenStreetMap contributors (ODbL)",
  };
}

// ---- geometry helpers ------------------------------------------------------
export function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    a += (r[j]![0] + r[i]![0]) * (r[j]![1] - r[i]![1]);
  }
  return Math.abs(a / 2);
}
export interface BBoxPx { minx: number; miny: number; maxx: number; maxy: number; }
export function bboxOfRings(rings: Ring[]): BBoxPx {
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const ring of rings)
    for (const p of ring) {
      if (p[0] < minx) minx = p[0];
      if (p[0] > maxx) maxx = p[0];
      if (p[1] < miny) miny = p[1];
      if (p[1] > maxy) maxy = p[1];
    }
  return { minx, miny, maxx, maxy };
}
export function pointInRings(x: number, y: number, rings: Ring[]): boolean {
  let inside = false;
  for (const ring of rings)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const pi = ring[i]!, pj = ring[j]!;
      if (pi[1] > y !== pj[1] > y && x < ((pj[0] - pi[0]) * (y - pi[1])) / (pj[1] - pi[1] || 1e-12) + pi[0])
        inside = !inside;
    }
  return inside;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TreePoint { x: number; y: number; r: number; v: number; }
export function scatterTrees(
  polys: Poly[], spacing: number, jitter: number, rMin: number, rMax: number, cap: number, rand: () => number,
): TreePoint[] {
  const pts: TreePoint[] = [];
  for (const rings of polys) {
    if (rings.length === 0) continue;
    const bb = bboxOfRings(rings);
    for (let y = bb.miny; y <= bb.maxy; y += spacing)
      for (let x = bb.minx; x <= bb.maxx; x += spacing) {
        const jx = x + (rand() - 0.5) * spacing * jitter;
        const jy = y + (rand() - 0.5) * spacing * jitter;
        if (pointInRings(jx, jy, rings)) pts.push({ x: jx, y: jy, r: rMin + rand() * (rMax - rMin), v: rand() });
      }
  }
  if (pts.length > cap) {
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = pts[i]!; pts[i] = pts[j]!; pts[j] = tmp;
    }
    pts.length = cap;
  }
  pts.sort((p, q) => p.y - q.y);
  return pts;
}
