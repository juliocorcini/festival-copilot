import { describe, it, expect } from "vitest";
import {
  clampDrag,
  scrimOpacity,
  shouldDismiss,
  SHEET_DISMISS_RATIO,
  SHEET_FLICK_MIN_PX,
  SHEET_FLICK_VELOCITY,
} from "./sheetDrag";

describe("clampDrag", () => {
  it("passes through a downward drag unchanged", () => {
    expect(clampDrag(40)).toBe(40);
  });
  it("never lifts the sheet above its resting spot", () => {
    expect(clampDrag(-30)).toBe(0);
    expect(clampDrag(0)).toBe(0);
  });
});

describe("shouldDismiss", () => {
  const height = 400; // quarter = 100px

  it("dismisses once dragged past a quarter of the sheet height", () => {
    expect(shouldDismiss(height * SHEET_DISMISS_RATIO, height, 0)).toBe(true);
    expect(shouldDismiss(101, height, 0)).toBe(true);
  });

  it("springs back on a short, slow drag", () => {
    expect(shouldDismiss(60, height, 0)).toBe(false);
    expect(shouldDismiss(99, height, 0.1)).toBe(false);
  });

  it("dismisses on a fast flick even when the distance is small", () => {
    expect(shouldDismiss(SHEET_FLICK_MIN_PX, height, SHEET_FLICK_VELOCITY)).toBe(true);
    expect(shouldDismiss(50, height, 0.8)).toBe(true);
  });

  it("ignores a fast flick that barely moved (a jittery tap)", () => {
    expect(shouldDismiss(SHEET_FLICK_MIN_PX - 1, height, 1.2)).toBe(false);
  });

  it("falls back to flick-only when the height is unknown (0)", () => {
    expect(shouldDismiss(500, 0, 0)).toBe(false); // no distance rule without a height
    expect(shouldDismiss(40, 0, 0.6)).toBe(true); // flick still works
  });
});

describe("scrimOpacity", () => {
  it("is fully opaque at rest", () => {
    expect(scrimOpacity(0, 400)).toBe(1);
  });
  it("fades linearly with travel", () => {
    expect(scrimOpacity(200, 400)).toBeCloseTo(0.5, 5);
    expect(scrimOpacity(100, 400)).toBeCloseTo(0.75, 5);
  });
  it("never goes negative on an over-drag", () => {
    expect(scrimOpacity(600, 400)).toBe(0);
  });
  it("stays opaque when the height is unknown", () => {
    expect(scrimOpacity(120, 0)).toBe(1);
  });
});
