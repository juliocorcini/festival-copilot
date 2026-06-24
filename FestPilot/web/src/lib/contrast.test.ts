import { describe, expect, it } from "vitest";
import { contrastRatio, readableInkOn, relativeLuminance } from "./contrast";

const INK_DARK = "#0F0D09";

describe("contrast", () => {
  it("computes relative luminance at the extremes", () => {
    expect(relativeLuminance("#000000")).toBeCloseTo(0, 5);
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("computes the canonical black/white ratio (21:1)", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#abcdef", "#abcdef")).toBeCloseTo(1, 5);
  });

  it("keeps dark ink on the light palette entries", () => {
    // Amber and gold are bright → dark ink reads best and clears AA comfortably.
    expect(readableInkOn("#F5A623")).toBe(INK_DARK);
    expect(contrastRatio("#F5A623", INK_DARK)).toBeGreaterThan(4.5);
  });

  it("flips to white on the dark palette entry that fails AA with dark ink", () => {
    // The violet dot gives ~3.4:1 with dark ink (fails AA); white gives ~5.7:1 (passes).
    expect(contrastRatio("#7C3AED", INK_DARK)).toBeLessThan(4.5);
    expect(readableInkOn("#7C3AED")).toBe("#FFFFFF");
    expect(contrastRatio("#7C3AED", "#FFFFFF")).toBeGreaterThan(4.5);
  });

  it("picks the readable ink for every avatar palette color", () => {
    for (const c of ["#F5A623", "#0EA5E9", "#16A34A", "#EC4899", "#7C3AED"]) {
      const ink = readableInkOn(c);
      expect(contrastRatio(c, ink)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("tolerates malformed input without throwing", () => {
    expect(() => readableInkOn("")).not.toThrow();
    expect(() => readableInkOn("#zzz")).not.toThrow();
  });
});
