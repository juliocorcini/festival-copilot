// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  addBlock,
  addToPlan,
  applyArriveLate,
  applyLeaveEarly,
  clearTravelChoice,
  editBlockMeta,
  fittingAdds,
  fittingSwaps,
  rangeIsFree,
  removeBlock,
  removeFromPlan,
  resizeBlock,
  setFits,
  swapInPlan,
} from "./planEdit";
import { hasNoOverlaps } from "./intervals";
import type { PlanBlock, PlannableSet, PlanSlot } from "./types";

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

function block(id: string, startMin: number, endMin: number): PlanBlock {
  return { id, kind: "eat", label: id, startMs: startMin * MIN, endMs: endMin * MIN };
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

describe("personal blocks (DEC-073)", () => {
  // Plan: A 0–60, B 70–130, C 200–260. Free idle: 60–70 and 130–200.
  it("adds a block in a free gap and keeps it chronological", () => {
    const next = addBlock(plan, [], block("eat", 140, 180))!;
    expect(next.map((b) => b.id)).toEqual(["eat"]);
    expect(rangeIsFree(plan, next, { startMs: 60 * MIN, endMs: 70 * MIN })).toBe(true);
  });

  it("rejects a block that overlaps a set's effective interval", () => {
    expect(addBlock(plan, [], block("clash", 100, 160))).toBeNull(); // overlaps B (70–130)
  });

  it("rejects a block that overlaps another block", () => {
    const one = addBlock(plan, [], block("eat", 140, 175))!;
    expect(addBlock(plan, one, block("rest", 160, 190))).toBeNull();
  });

  it("a block fits the freed tail of an early-left set", () => {
    const cutPlan = [slot("a", 0, 60, "s1", 30)]; // a cut at 30 → effective end 30
    expect(addBlock(cutPlan, [], block("eat", 35, 55))).not.toBeNull();
    expect(addBlock([slot("a", 0, 60, "s1")], [], block("eat", 35, 55))).toBeNull();
  });

  it("resizes a block only into still-free time, and edits metadata freely", () => {
    const blocks = addBlock(plan, [], block("eat", 140, 170))!;
    expect(resizeBlock(plan, blocks, "eat", 140 * MIN, 205 * MIN)).toBeNull(); // would hit C (200–260)
    const grown = resizeBlock(plan, blocks, "eat", 135 * MIN, 195 * MIN)!;
    expect(grown[0]).toMatchObject({ startMs: 135 * MIN, endMs: 195 * MIN });
    const renamed = editBlockMeta(grown, "eat", { kind: "meet", label: "Meet Ana", note: "north gate" });
    expect(renamed[0]).toMatchObject({ kind: "meet", label: "Meet Ana", note: "north gate" });
  });

  it("removes a block", () => {
    const blocks = addBlock(plan, [], block("eat", 140, 180))!;
    expect(removeBlock(blocks, "eat")).toEqual([]);
  });
});

describe("travel choice (DEC-074)", () => {
  const two = [slot("a", 0, 60, "s1"), slot("b", 64, 140, "s2")];

  it("leave-early cuts the source's end and clears any arrive-late on the target", () => {
    const withLate = two.map((s) => (s.setId === "b" ? { ...s, lateStartMs: 70 * MIN } : s));
    const next = applyLeaveEarly(withLate, "a", "b", 56 * MIN);
    expect(next.find((s) => s.setId === "a")!.cutMs).toBe(56 * MIN);
    expect(next.find((s) => s.setId === "b")!.lateStartMs).toBeNull();
  });

  it("arrive-late pushes the target's start and clears any leave-early on the source", () => {
    const withCut = two.map((s) => (s.setId === "a" ? { ...s, cutMs: 56 * MIN } : s));
    const next = applyArriveLate(withCut, "a", "b", 68 * MIN);
    expect(next.find((s) => s.setId === "b")!.lateStartMs).toBe(68 * MIN);
    expect(next.find((s) => s.setId === "a")!.cutMs).toBeNull();
  });

  it("clear resets both sides of the transition", () => {
    const dirty = [
      { ...two[0]!, cutMs: 56 * MIN },
      { ...two[1]!, lateStartMs: 70 * MIN },
    ];
    const next = clearTravelChoice(dirty, "a", "b");
    expect(next.find((s) => s.setId === "a")!.cutMs).toBeNull();
    expect(next.find((s) => s.setId === "b")!.lateStartMs).toBeNull();
  });
});
