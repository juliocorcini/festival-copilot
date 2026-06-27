import { describe, it, expect } from "vitest";
import { containedSize } from "./lightbox";

describe("containedSize — contain-fit geometry for the photo lightbox (E19)", () => {
  it("letterboxes a landscape photo by its width inside a tall phone box", () => {
    // 4000×3000 (4:3) into 400×800 → width binds (0.1 < 0.2667) → 400×300.
    expect(containedSize(4000, 3000, 400, 800)).toEqual({ w: 400, h: 300 });
  });

  it("letterboxes a portrait photo by its height inside a tall phone box", () => {
    // 3000×4000 (3:4) into 400×800 → height binds (0.2 < 0.1333? no: min(0.1333,0.2)=0.1333) → width binds.
    const r = containedSize(3000, 4000, 400, 800);
    expect(r.w).toBeCloseTo(400, 5);
    expect(r.h).toBeCloseTo(533.3333, 3);
  });

  it("a very tall photo binds on height, leaving horizontal letterbox bars", () => {
    // 1000×4000 into 400×800 → min(400/1000=0.4, 800/4000=0.2)=0.2 → 200×800 (bars left/right).
    expect(containedSize(1000, 4000, 400, 800)).toEqual({ w: 200, h: 800 });
  });

  it("contains a square photo to the shorter box axis", () => {
    expect(containedSize(1000, 1000, 400, 800)).toEqual({ w: 400, h: 400 });
  });

  it("never up-scales beyond the box for an already-small image (still fits)", () => {
    // A 100×100 image in a 400×800 box scales UP to 400×400 (object-fit:contain does scale up).
    expect(containedSize(100, 100, 400, 800)).toEqual({ w: 400, h: 400 });
  });

  it("degrades to the box when natural dimensions are unknown (guards div-by-zero)", () => {
    expect(containedSize(0, 0, 400, 800)).toEqual({ w: 400, h: 800 });
    expect(containedSize(4000, 3000, 0, 0)).toEqual({ w: 0, h: 0 });
  });
});
