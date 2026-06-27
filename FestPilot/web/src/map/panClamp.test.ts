import { describe, it, expect } from "vitest";
import { clampPan, fitScale, fitView, NO_INSETS, type Insets, type Size, type View } from "./panClamp";

const world: Size = { w: 1000, h: 800 };
const viewport: Size = { w: 400, h: 700 };

describe("fitScale / fitView — cover-fit (DEC-077, no black border)", () => {
  it("covers the bare viewport (larger axis wins) and centres the crop", () => {
    const v = fitView(world, viewport);
    // cover = max(400/1000=0.4, 700/800=0.875) = 0.875 — height fills exactly, width overflows + crops
    expect(v.scale).toBeCloseTo(0.875, 6);
    expect(fitScale(world, viewport)).toBeCloseTo(0.875, 6);
    // centred crop: x negative (875 wide into 400), y exact (700 into 700)
    expect(v.x).toBeCloseTo((400 - 1000 * 0.875) / 2, 6); // (400-875)/2 = -237.5
    expect(v.y).toBeCloseTo(0, 6);
    // invariant: the scaled world fully covers the viewport (no void on either axis)
    expect(1000 * v.scale).toBeGreaterThanOrEqual(viewport.w - 1e-6);
    expect(800 * v.scale).toBeGreaterThanOrEqual(viewport.h - 1e-6);
  });

  it("covers the safe rect (chrome insets), never letterboxing the venue", () => {
    const insets: Insets = { top: 80, right: 0, bottom: 160, left: 0 };
    const v = fitView(world, viewport, insets);
    const safeW = 400;
    const safeH = 700 - 80 - 160; // 460
    const scale = Math.max(safeW / 1000, safeH / 800); // max(0.4, 0.575) = 0.575
    expect(v.scale).toBeCloseTo(scale, 6);
    // y offset by the top inset + centred within the safe height; the world covers the safe rect
    expect(v.y).toBeCloseTo(80 + (safeH - 800 * scale) / 2, 6);
    expect(1000 * v.scale).toBeGreaterThanOrEqual(safeW - 1e-6);
    expect(800 * v.scale).toBeGreaterThanOrEqual(safeH - 1e-6);
  });
});

describe("clampPan — never drag into the void", () => {
  it("bounds over-pan in every direction at a zoomed-in scale", () => {
    const scale = 2; // world renders 2000×1600 into a 400×700 viewport
    const overPanned: View = { x: 5000, y: 5000, scale };
    const c = clampPan(overPanned, world, viewport, NO_INSETS);
    // near edges may sit at most at the safe edge (bleed 0) → x ≤ 0, y ≤ 0
    expect(c.x).toBeLessThanOrEqual(0);
    expect(c.y).toBeLessThanOrEqual(0);
    // far edges must still cover the viewport → x + 2000 ≥ 400, y + 1600 ≥ 700
    expect(c.x + world.w * scale).toBeGreaterThanOrEqual(viewport.w);
    expect(c.y + world.h * scale).toBeGreaterThanOrEqual(viewport.h);

    const overNeg: View = { x: -5000, y: -5000, scale };
    const c2 = clampPan(overNeg, world, viewport, NO_INSETS);
    expect(c2.x).toBe(viewport.w - world.w * scale); // pinned to the right edge
    expect(c2.y).toBe(viewport.h - world.h * scale);
  });

  it("holds the cover invariant across several scales and sizes", () => {
    const sizes: Size[] = [
      { w: 320, h: 568 },
      { w: 414, h: 896 },
      { w: 768, h: 1024 },
    ];
    for (const vp of sizes) {
      for (const scale of [fitScale(world, vp), 1, 3, 8]) {
        for (const probe of [-9999, -100, 0, 250, 9999]) {
          const c = clampPan({ x: probe, y: probe, scale }, world, vp, NO_INSETS);
          const Lx = world.w * scale;
          const Ly = world.h * scale;
          if (Lx >= vp.w) {
            expect(c.x).toBeLessThanOrEqual(1e-6);
            expect(c.x + Lx).toBeGreaterThanOrEqual(vp.w - 1e-6);
          }
          if (Ly >= vp.h) {
            expect(c.y).toBeLessThanOrEqual(1e-6);
            expect(c.y + Ly).toBeGreaterThanOrEqual(vp.h - 1e-6);
          }
        }
      }
    }
  });

  it("centres an under-sized world in the safe rect instead of pinning it", () => {
    const scale = 0.2; // world renders 200×160, smaller than the 400×700 viewport
    const c = clampPan({ x: 9999, y: -9999, scale }, world, viewport, NO_INSETS);
    expect(c.x).toBeCloseTo((400 - 200) / 2, 6); // 100
    expect(c.y).toBeCloseTo((700 - 160) / 2, 6); // 270
  });

  it("respects insets when centring an under-sized world", () => {
    const insets: Insets = { top: 100, right: 0, bottom: 200, left: 0 };
    const scale = 0.2;
    const c = clampPan({ x: 0, y: 0, scale }, world, viewport, insets);
    const safeH = 700 - 100 - 200; // 400
    expect(c.y).toBeCloseTo(100 + (safeH - 160) / 2, 6); // 100 + 120 = 220
  });

  it("tolerates a small bleed at the edges", () => {
    const scale = 2;
    const bleed = 24;
    const c = clampPan({ x: 9999, y: 9999, scale }, world, viewport, NO_INSETS, bleed);
    expect(c.x).toBeCloseTo(bleed, 6); // near edge allowed `bleed` px inside
    expect(c.y).toBeCloseTo(bleed, 6);
  });
});
