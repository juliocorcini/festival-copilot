import { describe, expect, it } from "vitest";
import { geoToSvg, svgToGeo, type Affine } from "./transform";

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
