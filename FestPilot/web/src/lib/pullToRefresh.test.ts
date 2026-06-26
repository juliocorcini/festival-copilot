import { describe, expect, it } from "vitest";
import {
  PULL_MAX,
  PULL_TRIGGER,
  pullProgress,
  pullRotation,
  resistPull,
  shouldTrigger,
} from "./pullToRefresh";

describe("resistPull (rubber-band)", () => {
  it("is zero at or below the origin", () => {
    expect(resistPull(0)).toBe(0);
    expect(resistPull(-50)).toBe(0);
  });

  it("matches the closed-form asymptote at key points", () => {
    // raw=max → max/2; raw=2·max → 2·max/3; raw=10·max → max·10/11
    expect(resistPull(PULL_MAX)).toBeCloseTo(PULL_MAX / 2, 5); // 45
    expect(resistPull(2 * PULL_MAX)).toBeCloseTo((2 * PULL_MAX) / 3, 5); // 60
    expect(resistPull(10 * PULL_MAX)).toBeCloseTo((PULL_MAX * 10) / 11, 5); // ~81.8
  });

  it("never exceeds the cap and increases monotonically", () => {
    let prev = 0;
    for (let raw = 1; raw <= 4000; raw += 37) {
      const d = resistPull(raw);
      expect(d).toBeLessThan(PULL_MAX);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it("honors a custom max", () => {
    expect(resistPull(120, 120)).toBeCloseTo(60, 5);
    expect(resistPull(240, 120)).toBeCloseTo(80, 5);
  });
});

describe("shouldTrigger", () => {
  it("arms only at or past the threshold", () => {
    expect(shouldTrigger(PULL_TRIGGER - 1)).toBe(false);
    expect(shouldTrigger(PULL_TRIGGER)).toBe(true);
    expect(shouldTrigger(PULL_TRIGGER + 20)).toBe(true);
  });

  it("a fast scroll-up sized pull (50px resisted) does NOT arm at the default trigger", () => {
    expect(shouldTrigger(50)).toBe(false);
  });
});

describe("pullProgress + pullRotation", () => {
  it("progress is a clamped fraction of the trigger", () => {
    expect(pullProgress(0)).toBe(0);
    expect(pullProgress(PULL_TRIGGER / 2)).toBeCloseTo(0.5, 5);
    expect(pullProgress(PULL_TRIGGER)).toBe(1);
    expect(pullProgress(PULL_TRIGGER * 5)).toBe(1); // clamped
  });

  it("rotation maps progress to ~300deg at the trigger", () => {
    expect(pullRotation(0)).toBe(0);
    expect(pullRotation(PULL_TRIGGER / 2)).toBeCloseTo(150, 5);
    expect(pullRotation(PULL_TRIGGER)).toBe(300);
    expect(pullRotation(PULL_TRIGGER * 3)).toBe(300); // clamped
  });
});
