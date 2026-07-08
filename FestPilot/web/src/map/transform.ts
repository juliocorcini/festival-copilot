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
  iconUrl?: string | null;
  iconLng?: number | null;
  iconLat?: number | null;
  iconScale?: number | null;
  isSpoiler?: boolean;
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

export interface GeoPoint {
  lng: number;
  lat: number;
}
export interface PixelPoint {
  x: number;
  y: number;
}

function det3(
  m11: number, m12: number, m13: number,
  m21: number, m22: number, m23: number,
  m31: number, m32: number, m33: number
): number {
  return (
    m11 * (m22 * m33 - m23 * m32) -
    m12 * (m21 * m33 - m23 * m31) +
    m13 * (m21 * m32 - m22 * m31)
  );
}

/** Solve one axis of the centred normal equations (Cramer's rule on the 3×3 system). */
function solveAxis(
  Suu: number, Suv: number, Su: number, Svv: number, Sv: number, n: number,
  Stu: number, Stv: number, St: number
): [number, number, number] {
  const det = det3(Suu, Suv, Su, Suv, Svv, Sv, Su, Sv, n);
  const k1 = det3(Stu, Suv, Su, Stv, Svv, Sv, St, Sv, n) / det;
  const k2 = det3(Suu, Stu, Su, Suv, Stv, Sv, Su, St, n) / det;
  const k3 = det3(Suu, Suv, Stu, Suv, Svv, Stv, Su, Sv, St) / det;
  return [k1, k2, k3];
}

/**
 * Least-squares 6-coefficient affine fit GPS (lng,lat) -> pixel (x,y), centred on the control-point
 * centroid for numerical stability then folded back (ported from the map-art spike for the in-product
 * georeference editor, DEC-064). Needs >= 3 non-collinear control points.
 */
export function fitAffine(src: GeoPoint[], dst: PixelPoint[]): Affine {
  const n = src.length;
  const lng0 = src.reduce((s, p) => s + p.lng, 0) / n;
  const lat0 = src.reduce((s, p) => s + p.lat, 0) / n;

  let Suu = 0, Suv = 0, Su = 0, Svv = 0, Sv = 0;
  let Sxu = 0, Sxv = 0, Sx = 0;
  let Syu = 0, Syv = 0, Sy = 0;

  for (let i = 0; i < n; i++) {
    const u = src[i]!.lng - lng0;
    const v = src[i]!.lat - lat0;
    const x = dst[i]!.x;
    const y = dst[i]!.y;
    Suu += u * u; Suv += u * v; Su += u; Svv += v * v; Sv += v;
    Sxu += x * u; Sxv += x * v; Sx += x;
    Syu += y * u; Syv += y * v; Sy += y;
  }

  const [a, b, cCentred] = solveAxis(Suu, Suv, Su, Svv, Sv, n, Sxu, Sxv, Sx);
  const [d, e, fCentred] = solveAxis(Suu, Suv, Su, Svv, Sv, n, Syu, Syv, Sy);
  const c = cCentred - a * lng0 - b * lat0;
  const f = fCentred - d * lng0 - e * lat0;
  return { a, b, c, d, e, f };
}

export interface AffineResidual {
  maxPx: number;
  meanPx: number;
}

/** Fit quality: the max and mean pixel error of the affine across the control points. */
export function residual(t: Affine, src: GeoPoint[], dst: PixelPoint[]): AffineResidual {
  let max = 0;
  let sum = 0;
  for (let i = 0; i < src.length; i++) {
    const [px, py] = geoToSvg(t, src[i]!.lng, src[i]!.lat);
    const dist = Math.hypot(px - dst[i]!.x, py - dst[i]!.y);
    max = Math.max(max, dist);
    sum += dist;
  }
  return { maxPx: max, meanPx: src.length ? sum / src.length : 0 };
}

/**
 * Invert the affine: a point in SVG canvas space -> [lng, lat]. Used by the meeting-point
 * pick-spot map (B4.1) to turn a tap on the illustration into a real coordinate. Returns null
 * for a degenerate (non-invertible) transform.
 */
export function svgToGeo(t: Affine, sx: number, sy: number): [number, number] | null {
  const det = t.a * t.e - t.b * t.d;
  if (det === 0) return null;
  const u = sx - t.c;
  const v = sy - t.f;
  const lng = (t.e * u - t.b * v) / det;
  const lat = (-t.d * u + t.a * v) / det;
  return [lng, lat];
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
