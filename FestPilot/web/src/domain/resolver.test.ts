// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasNoOverlaps } from "./intervals";
import {
  pickEarliestEnd,
  pickFirst,
  pickOption,
  pickSet,
  previewRemainingClashes,
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
    // Anchor = short (0–60). Options are short + only its true overlaps: long (0–180) overlaps it;
    // t1/t2 (start 120/130) do NOT overlap 0–60, so they are NOT offered here (anchor-overlap, not chain).
    expect(start.decision!.options.map((o) => o.id)).toEqual(["short", "long"]);

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

  it("pickSet locks an added nearby act and respects the gate", () => {
    const favorites = [set("c1a", 0, 60), set("c1b", 30, 90)];
    const start = startResolver(favorites);
    // An act not in the cluster, playing right after the clash window — lockable.
    const added = set("added", 95, 140, "s2");
    const snap = pickSet(start, added);
    expect(snap.locked.map((s) => s.setId)).toEqual(["added"]);
    // The original clash members start before 'added' ends? No — they start at 0/30 < lockedEnd(140),
    // so committing to 'added' drops them.
    expect(snap.dropped.map((s) => s.id).sort()).toEqual(["c1a", "c1b"]);
    expect(hasNoOverlaps(snap.locked)).toBe(true);

    // A set that starts before the gate is rejected (no-op) to preserve the invariant.
    const locked = pickOption(start, "c1a");
    expect(pickSet(locked, set("tooEarly", 0, 20))).toBe(locked);
  });

  it("pickOption with a cut records a partial set and frees a later overlapping favorite", () => {
    // long 0–180 clashes with short 0–60; t 90–150 starts inside long's full run.
    const favorites = [set("long", 0, 180), set("short", 0, 60), set("t", 90, 150)];
    const start = startResolver(favorites);
    // Leave 'long' early at minute 80 → its end no longer blocks t (starts 90).
    const cut = 80 * MIN;
    const snap = pickOption(start, "long", cut);
    const longSlot = snap.locked.find((s) => s.setId === "long")!;
    expect(longSlot.cutMs).toBe(cut);
    expect(snap.locked.map((s) => s.setId)).toEqual(["long", "t"]);
    expect(hasNoOverlaps(snap.locked.map((s) => ({ startMs: s.startMs, endMs: longSlot === s ? s.cutMs! : s.endMs })))).toBe(true);
  });

  it("previewRemainingClashes lists upcoming clash windows (current first)", () => {
    const favorites = [
      set("c1a", 0, 60), set("c1b", 30, 90),
      set("solo", 100, 150),
      set("c2a", 200, 260), set("c2b", 230, 290), set("c2c", 240, 300),
    ];
    const windows = previewRemainingClashes(startResolver(favorites));
    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({ startMs: 0, optionCount: 2 });
    expect(windows[1]).toMatchObject({ startMs: 200 * MIN, optionCount: 3 });
  });

  it("offers only acts overlapping the 16:00 anchor, not a transitive chain (the Lock-in headline bug)", () => {
    // Julio's scenario: three early non-clashing favorites, then a 16:00–22:00 spread that chains
    // transitively (16:00∩16:30, 16:30∩17:15, 17:15∩18:00) but where 16:00 does NOT overlap 21:00.
    const favorites = [
      set("f12", 720, 780), // 12:00–13:00
      set("f13", 780, 840), // 13:00–14:00
      set("f1430", 870, 930), // 14:30–15:30
      set("a16", 960, 1020), // 16:00–17:00
      set("b1630", 990, 1050), // 16:30–17:30 (overlaps a16)
      set("c1715", 1035, 1095), // 17:15–18:15 (overlaps b1630, NOT a16)
      set("d18", 1080, 1140), // 18:00–19:00 (overlaps c1715)
      set("e21", 1260, 1320), // 21:00–22:00 (alone)
    ];
    let snap = startResolver(favorites);
    // The three early singles auto-lock; the first decision is the 16:00 anchor with only its overlaps.
    expect(snap.locked.map((s) => s.setId)).toEqual(["f12", "f13", "f1430"]);
    expect(snap.decision!.startMs).toBe(960 * MIN);
    expect(snap.decision!.options.map((o) => o.id)).toEqual(["a16", "b1630"]);
    expect(snap.decision!.options.map((o) => o.id)).not.toContain("c1715");
    expect(snap.decision!.options.map((o) => o.id)).not.toContain("e21");

    // Pick 16:00 → the next decision is the next real overlap in chronological order (17:15 ∩ 18:00).
    snap = pickOption(snap, "a16");
    expect(snap.decision!.startMs).toBe(1035 * MIN);
    expect(snap.decision!.options.map((o) => o.id)).toEqual(["c1715", "d18"]);

    // Pick 17:15 → 18:00 is consumed; the lone 21:00 set auto-locks and resolution completes.
    snap = pickOption(snap, "c1715");
    expect(snap.decision).toBeNull();
    expect(snap.locked.map((s) => s.setId)).toEqual(["f12", "f13", "f1430", "a16", "c1715", "e21"]);
    expect(hasNoOverlaps(snap.locked)).toBe(true);
  });

  it("previewRemainingClashes counts anchor-overlap decisions and matches decisionsTotal", () => {
    const favorites = [
      set("f12", 720, 780),
      set("f13", 780, 840),
      set("f1430", 870, 930),
      set("a16", 960, 1020),
      set("b1630", 990, 1050),
      set("c1715", 1035, 1095),
      set("d18", 1080, 1140),
      set("e21", 1260, 1320),
    ];
    const start = startResolver(favorites);
    const windows = previewRemainingClashes(start);
    // Two real decisions on the earliest-end walk: the 16:00 pair and the 17:15 pair.
    expect(windows.map((w) => w.startMs)).toEqual([960 * MIN, 1035 * MIN]);
    expect(windows.map((w) => w.optionCount)).toEqual([2, 2]);
    // The progress denominator agrees with the preview count.
    expect(start.decisionsTotal).toBe(windows.length);
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
