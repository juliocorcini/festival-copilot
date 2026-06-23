/**
 * Least-squares 2D affine fit: GPS (lng,lat) -> SVG (x,y) — the runtime transform
 * stored per festival map (DEC-030: 6 coefficients).
 *
 *   x = a*lng + b*lat + c ;  y = d*lng + e*lat + f
 *
 * Fit is centred on the GCP centroid for numerical stability, then folded back.
 */
export interface Affine {
  a: number; b: number; c: number;
  d: number; e: number; f: number;
}
export interface GeoPoint { lng: number; lat: number; }
export interface PixelPoint { x: number; y: number; }

function det3(
  m11: number, m12: number, m13: number,
  m21: number, m22: number, m23: number,
  m31: number, m32: number, m33: number,
): number {
  return (
    m11 * (m22 * m33 - m23 * m32) -
    m12 * (m21 * m33 - m23 * m31) +
    m13 * (m21 * m32 - m22 * m31)
  );
}

function solveAxis(
  Suu: number, Suv: number, Su: number, Svv: number, Sv: number, n: number,
  Stu: number, Stv: number, St: number,
): [number, number, number] {
  const det = det3(Suu, Suv, Su, Suv, Svv, Sv, Su, Sv, n);
  const k1 = det3(Stu, Suv, Su, Stv, Svv, Sv, St, Sv, n) / det;
  const k2 = det3(Suu, Stu, Su, Suv, Stv, Sv, Su, St, n) / det;
  const k3 = det3(Suu, Suv, Stu, Suv, Svv, Stv, Su, Sv, St) / det;
  return [k1, k2, k3];
}

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

export function applyAffine(t: Affine, lng: number, lat: number): PixelPoint {
  return { x: t.a * lng + t.b * lat + t.c, y: t.d * lng + t.e * lat + t.f };
}

export interface Residual { maxPx: number; meanPx: number; }
export function residual(t: Affine, src: GeoPoint[], dst: PixelPoint[]): Residual {
  let max = 0, sum = 0;
  for (let i = 0; i < src.length; i++) {
    const p = applyAffine(t, src[i]!.lng, src[i]!.lat);
    const dist = Math.hypot(p.x - dst[i]!.x, p.y - dst[i]!.y);
    max = Math.max(max, dist);
    sum += dist;
  }
  return { maxPx: max, meanPx: sum / src.length };
}
