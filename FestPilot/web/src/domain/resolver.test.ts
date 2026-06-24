// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasNoOverlaps } from "./intervals";
import {
  pickEarliestEnd,
  pickFirst,
  pickOption,
  resolvePlan,
  startResolver,
  type PickStrategy,
} from "./resolver";
import type { PlannableSet } from "./types";

const MIN = 60_000;
function set(id: string, startMin: number, endMin: number, stage = "s"): PlannableSet {
  return {
    id,
    actKey: id,
    label: id,
    stageId: stage,
    stageName: stage,
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    day: "D1",
    weekendId: "W1",
  };
}

describe("resolvePlan — concrete scenarios", () => {
  it("locks every favorite when nothing clashes", () => {
    const favorites = [set("A", 0, 60), set("B", 60, 120), set("C", 130, 190)];
    const { locked, dropped } = resolvePlan(favorites);
    expect(locked.map((s) => s.setId)).toEqual(["A", "B", "C"]);
    expect(dropped).toHaveLength(0);
  });

  it("resolves the 4-way clash (#12b) by keeping exactly one of the cluster", () => {
    // Amelie/Adam/Tale/Stephan all 23:00–00:30 → one slot, pick Tale Of Us.
    const favorites = [
      set("amelie", 1380, 1470),
      set("adam", 1380, 1470),
      set("tale", 1380, 1470),
      set("stephan", 1380, 1470),
    ];
    const choose: PickStrategy = (d) => d.options.find((o) => o.id === "tale")!;
    const { locked, dropped } = resolvePlan(favorites, choose);
    expect(locked.map((s) => s.setId)).toEqual(["tale"]);
    expect(dropped.map((s) => s.id).sort()).toEqual(["adam", "amelie", "stephan"]);
  });

  it("honours the gate: the same cluster resolves differently downstream depending on the pick", () => {
    // long[0–180] bridges short[0–60] and the t1/t2 pair → one chained cluster of four.
    const favorites = [set("long", 0, 180), set("short", 0, 60), set("t1", 120, 200), set("t2", 130, 190)];
    const start = startResolver(favorites);
    // Sorted by start then end: short (ends 60) precedes long (ends 180); both start at 0.
    expect(start.decision!.options.map((o) => o.id)).toEqual(["short", "long", "t1", "t2"]);

    // Picking the long set (ends 180) absorbs t1/t2 — they start before 180 and are dropped.
    const viaLong = pickOption(start, "long");
    expect(viaLong.decision).toBeNull();
    expect(viaLong.locked.map((s) => s.setId)).toEqual(["long"]);
    expect(hasNoOverlaps(viaLong.locked)).toBe(true);

    // Picking the short set (ends 60) drops long but unlocks the downstream t1/t2 clash — the gate.
    const viaShort = pickOption(start, "short");
    expect(viaShort.decision!.options.map((o) => o.id)).toEqual(["t1", "t2"]);
    const final = pickOption(viaShort, "t1");
    expect(final.decision).toBeNull();
    expect(final.locked.map((s) => s.setId)).toEqual(["short", "t1"]);
    expect(hasNoOverlaps(final.locked)).toBe(true);
  });

  it("auto-locks singles between clashes and exposes a second decision", () => {
    const favorites = [
      set("c1a", 0, 60),
      set("c1b", 30, 90),
      set("single", 100, 150),
      set("c2a", 200, 260),
      set("c2b", 230, 290),
    ];
    let snap = startResolver(favorites);
    expect(snap.decision!.options.map((o) => o.id)).toEqual(["c1a", "c1b"]);
    snap = pickOption(snap, "c1a");
    // 'single' auto-locks, then the second clash surfaces.
    expect(snap.locked.map((s) => s.setId)).toContain("single");
    expect(snap.decision!.options.map((o) => o.id)).toEqual(["c2a", "c2b"]);
    snap = pickOption(snap, "c2b");
    expect(snap.decision).toBeNull();
    expect(hasNoOverlaps(snap.locked)).toBe(true);
  });
});

// Deterministic PRNG so property failures are reproducible.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("resolvePlan — property: the locked plan never overlaps", () => {
  const strategies: PickStrategy[] = [pickFirst, pickEarliestEnd];

  it("holds for 300 random favorite sets across all strategies", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const rand = mulberry32(seed);
      const count = Math.floor(rand() * 14);
      const favorites: PlannableSet[] = [];
      for (let i = 0; i < count; i++) {
        const start = Math.floor(rand() * 600);
        const duration = 30 + Math.floor(rand() * 120);
        favorites.push(set(`f${i}`, start, start + duration, `stage${Math.floor(rand() * 4)}`));
      }

      const randomPick: PickStrategy = (d) => d.options[Math.floor(rand() * d.options.length)]!;
      for (const strategy of [...strategies, randomPick]) {
        const { locked, dropped } = resolvePlan(favorites, strategy);

        // 1. Zero-overlap invariant.
        expect(hasNoOverlaps(locked)).toBe(true);
        // 2. Conservation: every favorite is either locked or dropped, with no duplicates.
        const lockedIds = locked.map((s) => s.setId);
        const droppedIds = dropped.map((s) => s.id);
        const union = new Set([...lockedIds, ...droppedIds]);
        expect(union.size).toBe(favorites.length);
        expect(lockedIds.length + droppedIds.length).toBe(favorites.length);
        // 3. Chronological & gated: each locked set starts at/after the previous one ends.
        for (let k = 1; k < locked.length; k++) {
          expect(locked[k]!.startMs).toBeGreaterThanOrEqual(locked[k - 1]!.endMs);
        }
      }
    }
  });
});
