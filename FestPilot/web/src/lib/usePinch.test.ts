import { describe, expect, it } from "vitest";
import { createPinchTracker, PINCH_STEP_IN, PINCH_STEP_OUT } from "./usePinch";

describe("createPinchTracker (DEC-085: one step per gesture)", () => {
  it("fires once when fingers spread past the out-threshold, then latches until end", () => {
    const tracker = createPinchTracker();
    tracker.start(100);
    expect(tracker.move(120)).toBeNull(); // +20% — below the 40% threshold
    expect(tracker.move(100 * PINCH_STEP_OUT)).toBe("out"); // exactly at threshold → one step
    // Latched: keep spreading within the SAME gesture → no further steps (the old bug skipped levels).
    expect(tracker.move(200)).toBeNull();
    expect(tracker.move(400)).toBeNull();
  });

  it("fires once when fingers pinch past the in-threshold, then latches", () => {
    const tracker = createPinchTracker();
    tracker.start(200);
    expect(tracker.move(180)).toBeNull(); // −10%
    expect(tracker.move(200 * PINCH_STEP_IN)).toBe("in");
    expect(tracker.move(40)).toBeNull(); // still latched
  });

  it("re-arms only after end() — a new gesture can step again", () => {
    const tracker = createPinchTracker();
    tracker.start(100);
    expect(tracker.move(160)).toBe("out");
    expect(tracker.move(260)).toBeNull(); // locked
    tracker.end();
    tracker.start(100); // a fresh pinch
    expect(tracker.move(160)).toBe("out"); // steps again
  });

  it("never steps before a gesture starts, or after it ends", () => {
    const tracker = createPinchTracker();
    expect(tracker.move(999)).toBeNull(); // no baseline yet
    tracker.start(100);
    tracker.end();
    expect(tracker.move(999)).toBeNull(); // baseline cleared
  });

  it("uses a wider, log-symmetric threshold (40% out ↔ ~29% in)", () => {
    expect(PINCH_STEP_OUT).toBeCloseTo(1.4, 5);
    expect(PINCH_STEP_IN).toBeCloseTo(1 / 1.4, 5);
    // A 25% spread (the OLD threshold) must no longer trigger — accidental drift is ignored.
    const tracker = createPinchTracker();
    tracker.start(100);
    expect(tracker.move(125)).toBeNull();
  });
});
