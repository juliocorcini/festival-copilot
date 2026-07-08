import { describe, expect, it } from "vitest";
import { compareDaySummary, comparePlans, nextSharedSet } from "./memberCompare";
import type { PlannableSet } from "./types";

function set(id: string, startMs: number, endMs: number, label = `Set ${id}`): PlannableSet {
  return { id, actKey: `act-${id}`, label, stageId: null, stageName: "Stage", startMs, endMs, day: "FRI", weekendId: null };
}

describe("comparePlans", () => {
  const sets = [set("A", 1000, 2000), set("B", 2000, 3000), set("C", 3000, 4000), set("D", 4000, 5000)];

  it("identifies full overlap when both share the same sets", () => {
    const yours = new Set(["A", "B", "C"]);
    const theirs = new Set(["A", "B", "C"]);
    const result = comparePlans(yours, theirs, sets);
    expect(result.overlap).toHaveLength(3);
    expect(result.onlyYou).toHaveLength(0);
    expect(result.onlyThem).toHaveLength(0);
    expect(result.overlapRatio).toBe(1);
  });

  it("identifies zero overlap when no sets in common", () => {
    const yours = new Set(["A", "B"]);
    const theirs = new Set(["C", "D"]);
    const result = comparePlans(yours, theirs, sets);
    expect(result.overlap).toHaveLength(0);
    expect(result.onlyYou).toHaveLength(2);
    expect(result.onlyThem).toHaveLength(2);
    expect(result.overlapRatio).toBe(0);
  });

  it("correctly partitions mixed overlap", () => {
    const yours = new Set(["A", "B", "C"]);
    const theirs = new Set(["B", "C", "D"]);
    const result = comparePlans(yours, theirs, sets);
    expect(result.overlap.map((s) => s.id)).toEqual(["B", "C"]);
    expect(result.onlyYou.map((s) => s.id)).toEqual(["A"]);
    expect(result.onlyThem.map((s) => s.id)).toEqual(["D"]);
    expect(result.overlapRatio).toBeCloseTo(0.5);
  });

  it("returns slots sorted by startMs", () => {
    const yours = new Set(["C", "A"]);
    const theirs = new Set(["B", "C"]);
    const result = comparePlans(yours, theirs, sets);
    const times = result.slots.map((s) => s.set.startMs);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("handles empty inputs gracefully", () => {
    const result = comparePlans(new Set(), new Set(), sets);
    expect(result.slots).toHaveLength(0);
    expect(result.overlapRatio).toBe(0);
  });

  it("ignores IDs not present in allDaySets", () => {
    const yours = new Set(["A", "PHANTOM"]);
    const theirs = new Set(["A"]);
    const result = comparePlans(yours, theirs, sets);
    expect(result.overlap.map((s) => s.id)).toEqual(["A"]);
    expect(result.onlyYou).toHaveLength(0);
  });
});

describe("compareDaySummary", () => {
  it("summarizes overlap per day", () => {
    const yours = new Map([["FRI", new Set(["A", "B"])], ["SAT", new Set(["C"])]]);
    const theirs = new Map([["FRI", new Set(["B", "D"])], ["SAT", new Set(["C", "E"])]]);
    const days = [{ key: "FRI", label: "Fri" }, { key: "SAT", label: "Sat" }];
    const result = compareDaySummary(yours, theirs, days);
    expect(result[0]!.overlapCount).toBe(1);
    expect(result[0]!.yourCount).toBe(2);
    expect(result[0]!.theirCount).toBe(2);
    expect(result[1]!.overlapCount).toBe(1);
  });

  it("returns zero for days where one member has no data", () => {
    const yours = new Map([["FRI", new Set(["A"])]]);
    const theirs = new Map<string, Set<string>>();
    const days = [{ key: "FRI", label: "Fri" }];
    const result = compareDaySummary(yours, theirs, days);
    expect(result[0]!.overlapCount).toBe(0);
    expect(result[0]!.theirCount).toBe(0);
  });
});

describe("nextSharedSet", () => {
  const overlap = [set("A", 1000, 2000), set("B", 3000, 4000), set("C", 5000, 6000)];

  it("returns the first overlap set ending after now", () => {
    expect(nextSharedSet(overlap, 1500)?.id).toBe("A");
    expect(nextSharedSet(overlap, 2500)?.id).toBe("B");
    expect(nextSharedSet(overlap, 4500)?.id).toBe("C");
  });

  it("returns null when all overlap sets are in the past", () => {
    expect(nextSharedSet(overlap, 9000)).toBeNull();
  });

  it("returns null for empty overlap", () => {
    expect(nextSharedSet([], 0)).toBeNull();
  });
});
