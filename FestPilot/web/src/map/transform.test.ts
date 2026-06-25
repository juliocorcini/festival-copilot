import { describe, expect, it } from "vitest";
import { fitAffine, geoToSvg, residual, svgToGeo, type Affine, type GeoPoint, type PixelPoint } from "./transform";

// A realistic affine: ~0.0002°/px scale with a small rotation/shear, like a generated map export.
const AFFINE: Affine = { a: 5200, b: 120, c: -27000, d: -90, e: -5400, f: 280000 };

describe("map transform — svgToGeo is the inverse of geoToSvg", () => {
  it("round-trips a coordinate back to itself", () => {
    const lng = 4.0123;
    const lat = 51.0846;
    const [sx, sy] = geoToSvg(AFFINE, lng, lat);
    const back = svgToGeo(AFFINE, sx, sy);
    expect(back).not.toBeNull();
    expect(back![0]).toBeCloseTo(lng, 9);
    expect(back![1]).toBeCloseTo(lat, 9);
  });

  it("round-trips an SVG point back to itself", () => {
    const sx = 612.5;
    const sy = 388.25;
    const geo = svgToGeo(AFFINE, sx, sy)!;
    const [x, y] = geoToSvg(AFFINE, geo[0], geo[1]);
    expect(x).toBeCloseTo(sx, 6);
    expect(y).toBeCloseTo(sy, 6);
  });

  it("returns null for a degenerate (non-invertible) transform", () => {
    const degenerate: Affine = { a: 1, b: 2, c: 0, d: 2, e: 4, f: 0 }; // det = 1*4 - 2*2 = 0
    expect(svgToGeo(degenerate, 10, 20)).toBeNull();
  });
});

describe("fitAffine — least-squares georeference (DEC-064)", () => {
  // Sample the known AFFINE at five spread points in general position (deliberately not symmetric
  // about their centroid — a symmetric set can let least-squares absorb a single point's noise).
  const geo: GeoPoint[] = [
    { lng: 4.01, lat: 51.08 },
    { lng: 4.024, lat: 51.091 },
    { lng: 4.017, lat: 51.098 },
    { lng: 4.029, lat: 51.083 },
    { lng: 4.0135, lat: 51.0905 },
  ];
  const pix: PixelPoint[] = geo.map((g) => {
    const [x, y] = geoToSvg(AFFINE, g.lng, g.lat);
    return { x, y };
  });

  it("recovers the generating affine from exact control points", () => {
    const fit = fitAffine(geo, pix);
    for (const k of ["a", "b", "c", "d", "e", "f"] as const) {
      expect(fit[k]).toBeCloseTo(AFFINE[k], 3);
    }
    const r = residual(fit, geo, pix);
    expect(r.maxPx).toBeLessThan(1e-3);
    expect(r.meanPx).toBeLessThan(1e-3);
  });

  it("reports a non-zero residual when a control point carries pixel noise", () => {
    const noisy = pix.map((p, i) => (i === 0 ? { x: p.x + 30, y: p.y - 24 } : p));
    const fit = fitAffine(geo, noisy);
    const r = residual(fit, geo, noisy);
    expect(r.maxPx).toBeGreaterThan(1); // the fit can't pass exactly through a noised point
  });

  it("solves from the minimum of three control points", () => {
    const fit = fitAffine(geo.slice(0, 3), pix.slice(0, 3));
    expect(residual(fit, geo.slice(0, 3), pix.slice(0, 3)).maxPx).toBeLessThan(1e-3);
  });
});
