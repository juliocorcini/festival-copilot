// @vitest-environment node
import { describe, expect, it } from "vitest";
import { flatTravelMatrix } from "./partialSet";
import { buildPlanTimeline, type PlanBlockItem, type PlanGapItem, type PlanSetItem } from "./plan";
import type { PlanBlock, PlanSlot } from "./types";

const MIN = 60_000;
const travel = flatTravelMatrix(8);

function slot(
  setId: string,
  startMin: number,
  endMin: number,
  stageId: string,
  stageName: string,
  cutMin: number | null = null,
  lateMin: number | null = null
): PlanSlot {
  return {
    setId,
    actKey: setId,
    label: setId.toUpperCase(),
    stageId,
    stageName,
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    cutMs: cutMin == null ? null : cutMin * MIN,
    lateStartMs: lateMin == null ? null : lateMin * MIN,
  };
}

function block(id: string, kind: PlanBlock["kind"], startMin: number, endMin: number, label = id): PlanBlock {
  return { id, kind, label, startMs: startMin * MIN, endMs: endMin * MIN };
}

describe("buildPlanTimeline", () => {
  it("classifies done/now/upcoming and inserts walk + break gaps", () => {
    const slots = [
      slot("a", 0, 90, "s1", "MAINSTAGE"),
      slot("b", 100, 160, "s1", "MAINSTAGE"), // same stage, 10-min gap → no chip
      slot("c", 200, 260, "s2", "CAGE"), // stage change + long idle → walk + break
    ];
    const tl = buildPlanTimeline(slots, [], travel, 120 * MIN);

    expect(tl.setCount).toBe(3);
    expect(tl.breakCount).toBe(1);
    expect(tl.items.map((i) => i.kind)).toEqual(["set", "set", "gap", "set"]);

    const [a, b, gap, c] = tl.items as [PlanSetItem, PlanSetItem, PlanGapItem, PlanSetItem];
    expect(a.status).toBe("done");
    expect(b.status).toBe("now");
    expect(c.status).toBe("upcoming");
    // The gap carries the exact leg so the walk chip can open the right transition (DEC-079), never a recompute.
    expect(gap).toMatchObject({
      kind: "gap",
      fromStageId: "s1",
      toStageId: "s2",
      toStageName: "CAGE",
      atMs: 200 * MIN,
      walkMinutes: 8,
      breakMinutes: 32,
    });
  });

  it("honors a partial-set cut for end time, status and the following gap", () => {
    const slots = [
      slot("long", 0, 180, "s1", "MAINSTAGE", 80), // leaves early at minute 80
      slot("next", 90, 150, "s2", "CAGE"),
    ];
    const tl = buildPlanTimeline(slots, [], travel, 100 * MIN);
    const [long, gap] = tl.items as [PlanSetItem, PlanGapItem];

    expect(long.endMs).toBe(80 * MIN); // cut, not 180
    expect(long.status).toBe("done"); // now=100 is past the cut
    // gap from 80→90 = 10 min, walk 8 → break 2 (< threshold) but the walk still shows.
    expect(gap).toMatchObject({ kind: "gap", walkMinutes: 8, breakMinutes: 2 });
    expect(tl.breakCount).toBe(0);
  });

  it("is empty for no slots and gap-free for a single set", () => {
    expect(buildPlanTimeline([], [], travel, 0)).toMatchObject({ items: [], setCount: 0, breakCount: 0, blockCount: 0 });
    const one = buildPlanTimeline([slot("solo", 0, 60, "s1", "MAINSTAGE")], [], travel, 0);
    expect(one.items).toHaveLength(1);
    expect(one.items[0]!.kind).toBe("set");
  });
});

describe("buildPlanTimeline — travel resolution (DEC-074)", () => {
  // A 0–60 (s1), B 64–140 (s2): leaving A at 60 + 8 walk = 68 > 64 ⇒ 4-min overlap.
  const tight = [slot("a", 0, 60, "s1", "MAINSTAGE"), slot("b", 64, 140, "s2", "CAGE")];

  it("default 'leave early' trims the previous set's end so the walk fits", () => {
    const tl = buildPlanTimeline(tight, [], travel, 0, "leave-early");
    const [a, , b] = tl.items as [PlanSetItem, PlanGapItem, PlanSetItem];
    expect(a.endMs).toBe(56 * MIN); // 64 − 8 walk
    expect(b.startMs).toBe(64 * MIN); // unchanged
    expect(b.travelIn).toMatchObject({ resolution: "leave-early", explicit: false, lostMinutes: 4, walkMinutes: 8 });
    expect(tl.conflictCount).toBe(1);
  });

  it("default 'arrive late' pushes the next set's start instead", () => {
    const tl = buildPlanTimeline(tight, [], travel, 0, "arrive-late");
    const [a, , b] = tl.items as [PlanSetItem, PlanGapItem, PlanSetItem];
    expect(a.endMs).toBe(60 * MIN); // unchanged
    expect(b.startMs).toBe(68 * MIN); // 60 end + 8 walk
    expect(b.travelIn).toMatchObject({ resolution: "arrive-late", explicit: false, lostMinutes: 4 });
  });

  it("respects an explicit arrive-late choice over the default", () => {
    const chosen = [slot("a", 0, 60, "s1", "MAINSTAGE"), slot("b", 64, 140, "s2", "CAGE", null, 70)];
    const tl = buildPlanTimeline(chosen, [], travel, 0, "leave-early");
    const [a, , b] = tl.items as [PlanSetItem, PlanGapItem, PlanSetItem];
    expect(a.endMs).toBe(60 * MIN); // not trimmed — the user chose to arrive late
    expect(b.startMs).toBe(70 * MIN);
    expect(b.travelIn).toMatchObject({ resolution: "arrive-late", explicit: true, feasible: true });
    expect(tl.conflictCount).toBe(0); // an explicit choice is not an auto-resolution
  });

  it("flags an infeasible walk honestly (can't make it even leaving at the start)", () => {
    // A 0–60, B 5–120, walk 8: even leaving A at minute 0 you arrive at 8 > 5.
    const impossible = [slot("a", 0, 60, "s1", "MAINSTAGE"), slot("b", 5, 120, "s2", "CAGE")];
    const tl = buildPlanTimeline(impossible, [], travel, 0, "leave-early");
    const b = tl.items[tl.items.length - 1] as PlanSetItem;
    expect(b.travelIn?.feasible).toBe(false);
  });
});

describe("buildPlanTimeline — personal blocks (DEC-073)", () => {
  it("interleaves a block chronologically and counts it", () => {
    const slots = [slot("a", 0, 60, "s1", "MAINSTAGE"), slot("c", 200, 260, "s1", "MAINSTAGE")];
    const blocks = [block("eat", "eat", 80, 140, "Dinner")];
    const tl = buildPlanTimeline(slots, blocks, travel, 0, "leave-early");

    expect(tl.blockCount).toBe(1);
    expect(tl.items.map((i) => i.kind)).toEqual(["set", "gap", "block", "gap", "set"]);
    const blk = tl.items.find((i) => i.kind === "block") as PlanBlockItem;
    expect(blk.block.label).toBe("Dinner");
    expect(blk.status).toBe("upcoming"); // now=0 < block start (80) ⇒ upcoming
  });

  it("a live block reports status 'now'", () => {
    const slots = [slot("a", 0, 60, "s1", "MAINSTAGE")];
    const tl = buildPlanTimeline(slots, [block("rest", "rest", 80, 140)], travel, 100 * MIN);
    const blk = tl.items.find((i) => i.kind === "block") as PlanBlockItem;
    expect(blk.status).toBe("now");
  });
});
