import { describe, expect, it } from "vitest";
import { fitFontScale, shouldWrap } from "./fitText";

describe("fitFontScale", () => {
  it("keeps full size when the text already fits (or fits exactly)", () => {
    expect(fitFontScale(200, 300, 0.7)).toBe(1);
    expect(fitFontScale(300, 300, 0.7)).toBe(1);
  });

  it("shrinks to the exact ratio when a small reduction is enough", () => {
    // 240 / 300 = 0.8, comfortably above the 0.5 floor.
    expect(fitFontScale(300, 240, 0.5)).toBeCloseTo(0.8, 5);
  });

  it("never shrinks below the minimum scale (wrapping takes over instead)", () => {
    // Raw ratio would be 120/300 = 0.4, but the floor clamps it to 0.7.
    expect(fitFontScale(300, 120, 0.7)).toBe(0.7);
  });

  it("guards against zero/negative measurements (returns full size)", () => {
    expect(fitFontScale(0, 300, 0.7)).toBe(1);
    expect(fitFontScale(300, 0, 0.7)).toBe(1);
    expect(fitFontScale(-10, 300, 0.7)).toBe(1);
  });
});

describe("shouldWrap", () => {
  it("does not wrap when the scaled text fits on one line", () => {
    // 300 * 0.8 = 240, fits exactly into 240.
    expect(shouldWrap(300, 240, 0.8)).toBe(false);
  });

  it("wraps when even the floor scale still overflows", () => {
    // Clamped at 0.7 → 300 * 0.7 = 210 still wider than 120.
    expect(shouldWrap(300, 120, 0.7)).toBe(true);
  });

  it("does not wrap on missing measurements", () => {
    expect(shouldWrap(0, 120, 0.7)).toBe(false);
    expect(shouldWrap(300, 0, 0.7)).toBe(false);
  });
});
