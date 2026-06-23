/**
 * The GPS -> SVG bridge (DEC-030). The generator exports a 6-coefficient affine
 * with each map; the app applies it to drop real coordinates onto the illustration.
 */
export interface Affine {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
}

export interface StageGeo {
  name: string;
  lng: number;
  lat: number;
  matched: boolean;
}

export interface MapTransform {
  festival: string;
  venue: string;
  canvas: { width: number; height: number };
  bbox: { west: number; east: number; south: number; north: number };
  affine: Affine;
  stages: StageGeo[];
  source: string;
}

/** Apply the affine: a GPS coordinate -> a point in the SVG canvas coordinate space. */
export function geoToSvg(t: Affine, lng: number, lat: number): [number, number] {
  return [t.a * lng + t.b * lat + t.c, t.d * lng + t.e * lat + t.f];
}

const RAD = Math.PI / 180;

/** Approximate metres between two coordinates (equirectangular — fine at ~1 km). */
export function metersBetween(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const k = Math.cos(((aLat + bLat) / 2) * RAD);
  const dx = (bLng - aLng) * k;
  const dy = bLat - aLat;
  return Math.hypot(dx, dy) * 111320;
}

/** Coarse presence (DEC-015): the nearest stage to a coordinate, with its distance. */
export function nearestStage(
  stages: StageGeo[], lng: number, lat: number,
): { stage: StageGeo; meters: number } | null {
  let best: StageGeo | null = null;
  let bestM = Infinity;
  for (const s of stages) {
    const m = metersBetween(lng, lat, s.lng, s.lat);
    if (m < bestM) { bestM = m; best = s; }
  }
  return best ? { stage: best, meters: bestM } : null;
}

/** A coarse human label for where someone is, never raw GPS (privacy). */
export function coarseLabel(stages: StageGeo[], lng: number, lat: number): string {
  const near = nearestStage(stages, lng, lat);
  if (!near) return "somewhere";
  return near.meters < 70 ? `at ${near.stage.name}` : `near ${near.stage.name}`;
}
