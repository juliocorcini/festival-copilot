import { describe, expect, it } from "vitest";
import {
  cardDragStyle,
  swipeOutcome,
  swipeRelease,
  SWIPE_THRESHOLD,
  SWIPE_VELOCITY,
  SWIPE_FLICK_MIN_DX,
} from "./swipe";

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

describe("swipeRelease — distance OR flick (onboarding feel)", () => {
  const slow = 0; // no velocity → distance-only

  it("still commits on a slow drag past the distance threshold", () => {
    expect(swipeRelease(SWIPE_THRESHOLD, slow)).toBe("keep");
    expect(swipeRelease(-SWIPE_THRESHOLD, slow)).toBe("skip");
  });

  it("commits a fast flick that did NOT reach the distance threshold", () => {
    const shortDx = SWIPE_THRESHOLD - 20; // below distance commit
    expect(swipeRelease(shortDx, SWIPE_VELOCITY)).toBe("keep");
    expect(swipeRelease(-shortDx, -SWIPE_VELOCITY)).toBe("skip");
  });

  it("does not flick on a slow short drag (spring back)", () => {
    expect(swipeRelease(SWIPE_FLICK_MIN_DX, SWIPE_VELOCITY - 0.2)).toBeNull();
    expect(swipeRelease(-SWIPE_FLICK_MIN_DX, -(SWIPE_VELOCITY - 0.2))).toBeNull();
  });

  it("ignores a fast flick that barely moved (jitter/tap guard)", () => {
    expect(swipeRelease(SWIPE_FLICK_MIN_DX - 1, SWIPE_VELOCITY * 3)).toBeNull();
  });

  it("cancels when speed disagrees with displacement (finger pulled back)", () => {
    // moved right, but the last motion was a fast leftward pull-back → no commit
    expect(swipeRelease(40, -SWIPE_VELOCITY * 2)).toBeNull();
    expect(swipeRelease(-40, SWIPE_VELOCITY * 2)).toBeNull();
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
