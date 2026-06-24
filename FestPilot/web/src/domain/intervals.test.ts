// @vitest-environment node
import { describe, expect, it } from "vitest";
import { byStart, clashAt, clusterByOverlap, hasNoOverlaps, overlaps } from "./intervals";
import type { PlannableSet } from "./types";

function set(id: string, startMin: number, endMin: number): PlannableSet {
  const MIN = 60_000;
  return {
    id,
    actKey: id,
    label: id,
    stageId: "s",
    stageName: "Stage",
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    day: "D1",
    weekendId: "W1",
  };
}

describe("overlaps", () => {
  it("is true for genuine overlap and false for touching endpoints", () => {
    expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 5, endMs: 15 })).toBe(true);
    expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 10, endMs: 20 })).toBe(false);
    expect(overlaps({ startMs: 0, endMs: 10 }, { startMs: 11, endMs: 20 })).toBe(false);
  });

  it("is symmetric", () => {
    const a = { startMs: 0, endMs: 10 };
    const b = { startMs: 5, endMs: 7 };
    expect(overlaps(a, b)).toBe(overlaps(b, a));
  });
});

describe("clusterByOverlap", () => {
  it("groups chain-overlapping sets and isolates non-overlapping ones", () => {
    // A[0–60] B[30–90] chain together; C[120–180] is alone.
    const clusters = clusterByOverlap([set("C", 120, 180), set("A", 0, 60), set("B", 30, 90)]);
    expect(clusters).toHaveLength(2);
    expect(clusters[0]!.map((s) => s.id)).toEqual(["A", "B"]);
    expect(clusters[1]!.map((s) => s.id)).toEqual(["C"]);
  });

  it("treats a transitive chain (A∩B, B∩C, A∌C) as one cluster", () => {
    const clusters = clusterByOverlap([set("A", 0, 40), set("B", 30, 70), set("C", 60, 100)]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toHaveLength(3);
  });
});

describe("clashAt", () => {
  it("returns the anchor plus only its true overlaps, not a transitive chain", () => {
    // A∩B, B∩C, A∌C. clusterByOverlap chains all three; clashAt at the anchor offers only A,B.
    const options = clashAt([set("A", 0, 40), set("B", 30, 70), set("C", 60, 100)], -Infinity)!;
    expect(options.map((s) => s.id)).toEqual(["A", "B"]);
  });

  it("anchors on the earliest set at/after fromEnd and ignores earlier ones", () => {
    const sets = [set("early", 0, 60), set("x", 100, 160), set("y", 130, 200)];
    expect(clashAt(sets, 90)!.map((s) => s.id)).toEqual(["x", "y"]);
  });

  it("is a single-element list when the anchor overlaps nothing, and null when empty", () => {
    expect(clashAt([set("solo", 0, 60), set("later", 120, 180)], -Infinity)!.map((s) => s.id)).toEqual(["solo"]);
    expect(clashAt([set("a", 0, 60)], 9999)).toBeNull();
  });
});

describe("hasNoOverlaps", () => {
  it("accepts a chronological non-overlapping plan and rejects an overlapping one", () => {
    expect(hasNoOverlaps([set("A", 0, 60), set("B", 60, 120)])).toBe(true);
    expect(hasNoOverlaps([set("A", 0, 60), set("B", 59, 120)])).toBe(false);
  });
});

describe("byStart", () => {
  it("sorts by start then end deterministically", () => {
    const sorted = [set("B", 10, 50), set("A", 0, 90), set("C", 0, 30)].sort(byStart);
    expect(sorted.map((s) => s.id)).toEqual(["C", "A", "B"]);
  });
});
