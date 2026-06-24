import { describe, expect, it } from "vitest";
import { cardDragStyle, swipeOutcome, SWIPE_THRESHOLD } from "./swipe";

describe("swipeOutcome (R5.1)", () => {
  it("commits keep past the right threshold and skip past the left", () => {
    expect(swipeOutcome(SWIPE_THRESHOLD)).toBe("keep");
    expect(swipeOutcome(SWIPE_THRESHOLD + 40)).toBe("keep");
    expect(swipeOutcome(-SWIPE_THRESHOLD)).toBe("skip");
    expect(swipeOutcome(-SWIPE_THRESHOLD - 40)).toBe("skip");
  });

  it("does not commit inside the threshold band (spring back)", () => {
    expect(swipeOutcome(0)).toBeNull();
    expect(swipeOutcome(SWIPE_THRESHOLD - 1)).toBeNull();
    expect(swipeOutcome(-(SWIPE_THRESHOLD - 1))).toBeNull();
  });
});

describe("cardDragStyle (R5.1)", () => {
  it("reveals only the matching stamp for the drag direction", () => {
    const right = cardDragStyle(SWIPE_THRESHOLD / 2);
    expect(right.keepOpacity).toBeCloseTo(0.5);
    expect(right.skipOpacity).toBe(0);

    const left = cardDragStyle(-SWIPE_THRESHOLD);
    expect(left.skipOpacity).toBe(1);
    expect(left.keepOpacity).toBe(0);
  });

  it("clamps the tilt and the stamp opacity at the extremes", () => {
    const far = cardDragStyle(1000);
    expect(far.transform).toContain("rotate(12.00deg)");
    expect(far.keepOpacity).toBe(1);
    const farLeft = cardDragStyle(-1000);
    expect(farLeft.transform).toContain("rotate(-12.00deg)");
  });
});
