import { describe, it, expect } from "vitest";
import { statSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// DEC-040: the shipped map base is a slim pre-rendered WebP, not the ~20 MB inline-relief
// SVG. The live overlay reads the affine from the transform JSON. This guards the regression.
const mapsDir = join(dirname(fileURLToPath(import.meta.url)), "../../public/maps");

describe("shipped map assets (DEC-040)", () => {
  it("ships a slim WebP base for both palettes", () => {
    for (const file of ["tomorrowland-deschorre.webp", "tomorrowland-deschorre-day.webp"]) {
      const path = join(mapsDir, file);
      expect(existsSync(path), `${file} must exist`).toBe(true);
      const kb = statSync(path).size / 1024;
      expect(kb, `${file} should be well under 2 MB, got ${kb.toFixed(0)} KB`).toBeLessThan(2048);
    }
  });

  it("does not ship any heavy SVG base (relief must not be inlined)", () => {
    const svgs = readdirSync(mapsDir).filter((f) => f.endsWith(".svg"));
    expect(svgs, "no .svg base should ship — relief is baked into the WebP raster").toEqual([]);
  });

  it("keeps the affine transform JSON for the live overlay", () => {
    expect(existsSync(join(mapsDir, "tomorrowland-deschorre-transform.json"))).toBe(true);
  });
});
