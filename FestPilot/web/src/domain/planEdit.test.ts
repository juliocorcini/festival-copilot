// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addToPlan, fittingAdds, fittingSwaps, removeFromPlan, setFits, swapInPlan } from "./planEdit";
import { hasNoOverlaps } from "./intervals";
import type { PlannableSet, PlanSlot } from "./types";

const MIN = 60_000;

function slot(setId: string, startMin: number, endMin: number, stageId = "s1", cutMin: number | null = null): PlanSlot {
  return {
    setId,
    actKey: setId,
    label: setId.toUpperCase(),
    stageId,
    stageName: stageId,
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    cutMs: cutMin == null ? null : cutMin * MIN,
  };
}

function set(id: string, startMin: number, endMin: number, stageId = "s2", actKey = id): PlannableSet {
  return {
    id,
    actKey,
    label: id.toUpperCase(),
    stageId,
    stageName: stageId,
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    day: "FRIDAY",
    weekendId: "w1",
  };
}

// A clash-free plan: A 0–60, B 70–130, C 200–260.
const plan = [slot("a", 0, 60), slot("b", 70, 130), slot("c", 200, 260)];

describe("removeFromPlan", () => {
  it("drops the set and keeps zero overlaps", () => {
    const next = removeFromPlan(plan, "b");
    expect(next.map((s) => s.setId)).toEqual(["a", "c"]);
    expect(hasNoOverlaps(next)).toBe(true);
  });

  it("is a no-op for an unknown set id", () => {
    expect(removeFromPlan(plan, "zzz")).toHaveLength(3);
  });
});

describe("addToPlan", () => {
  it("inserts a non-overlapping set in chronological order, zero overlaps preserved", () => {
    const next = addToPlan(plan, set("d", 140, 180))!;
    expect(next.map((s) => s.setId)).toEqual(["a", "b", "d", "c"]);
    expect(hasNoOverlaps(next)).toBe(true);
  });

  it("rejects a set that would overlap an existing slot (returns null)", () => {
    expect(addToPlan(plan, set("x", 100, 160))).toBeNull(); // overlaps B (70–130)
  });

  it("treats touching endpoints as non-overlapping (end == next start fits)", () => {
    const next = addToPlan(plan, set("touch", 130, 200))!;
    expect(hasNoOverlaps(next)).toBe(true);
    expect(next.map((s) => s.setId)).toContain("touch");
  });

  it("returns the plan unchanged when the same act is already in it", () => {
    expect(addToPlan(plan, set("a2", 300, 360, "s9", "a"))).toBe(plan); // actKey "a" already present
  });
});

describe("swapInPlan", () => {
  it("replaces a set with a fitting one and keeps zero overlaps", () => {
    const next = swapInPlan(plan, "b", set("b2", 75, 125))!;
    expect(next.map((s) => s.setId)).toEqual(["a", "b2", "c"]);
    expect(hasNoOverlaps(next)).toBe(true);
  });

  it("allows a replacement that overlaps ONLY the slot being removed", () => {
    // b is 70–130; b2 70–135 overlaps b's old window but nothing else → allowed.
    const next = swapInPlan(plan, "b", set("b2", 70, 135))!;
    expect(hasNoOverlaps(next)).toBe(true);
  });

  it("rejects a replacement that would overlap a DIFFERENT slot", () => {
    expect(swapInPlan(plan, "b", set("b2", 50, 90))).toBeNull(); // would overlap A (0–60)
  });

  it("returns null when the target set id is not in the plan", () => {
    expect(swapInPlan(plan, "nope", set("b2", 75, 125))).toBeNull();
  });
});

describe("setFits honors partial-set cuts", () => {
  it("a set in the freed tail of an early-left slot fits", () => {
    const cutPlan = [slot("a", 0, 60, "s1", 30)]; // a is cut at 30 → effective end 30
    expect(setFits(cutPlan, { startMs: 35 * MIN, endMs: 55 * MIN })).toBe(true);
    expect(setFits([slot("a", 0, 60, "s1")], { startMs: 35 * MIN, endMs: 55 * MIN })).toBe(false);
  });
});

describe("fitting candidate filters", () => {
  const candidates = [set("d", 140, 180), set("x", 100, 160), set("dupA", 300, 360, "s9", "a")];

  it("fittingAdds keeps only non-overlapping, not-already-chosen acts", () => {
    const ok = fittingAdds(plan, candidates);
    expect(ok.map((s) => s.id)).toEqual(["d"]); // x overlaps B; dupA shares actKey "a"
  });

  it("fittingSwaps for a slot ignores that slot's own window", () => {
    const ok = fittingSwaps(plan, "b", [set("b2", 70, 135), set("bad", 50, 90)]);
    expect(ok.map((s) => s.id)).toEqual(["b2"]); // bad overlaps A
  });
});
