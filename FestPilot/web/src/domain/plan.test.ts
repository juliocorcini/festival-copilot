// @vitest-environment node
import { describe, expect, it } from "vitest";
import { flatTravelMatrix } from "./partialSet";
import { buildPlanTimeline, type PlanGapItem, type PlanSetItem } from "./plan";
import type { PlanSlot } from "./types";

const MIN = 60_000;
const travel = flatTravelMatrix(8);

function slot(setId: string, startMin: number, endMin: number, stageId: string, stageName: string, cutMin: number | null = null): PlanSlot {
  return {
    setId,
    actKey: setId,
    label: setId.toUpperCase(),
    stageId,
    stageName,
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    cutMs: cutMin == null ? null : cutMin * MIN,
  };
}

describe("buildPlanTimeline", () => {
  it("classifies done/now/upcoming and inserts walk + break gaps", () => {
    const slots = [
      slot("a", 0, 90, "s1", "MAINSTAGE"),
      slot("b", 100, 160, "s1", "MAINSTAGE"), // same stage, 10-min gap → no chip
      slot("c", 200, 260, "s2", "CAGE"), // stage change + long idle → walk + break
    ];
    const tl = buildPlanTimeline(slots, travel, 120 * MIN);

    expect(tl.setCount).toBe(3);
    expect(tl.breakCount).toBe(1);
    expect(tl.items.map((i) => i.kind)).toEqual(["set", "set", "gap", "set"]);

    const [a, b, gap, c] = tl.items as [PlanSetItem, PlanSetItem, PlanGapItem, PlanSetItem];
    expect(a.status).toBe("done");
    expect(b.status).toBe("now");
    expect(c.status).toBe("upcoming");
    expect(gap).toMatchObject({ kind: "gap", toStageName: "CAGE", walkMinutes: 8, breakMinutes: 32 });
  });

  it("honors a partial-set cut for end time, status and the following gap", () => {
    const slots = [
      slot("long", 0, 180, "s1", "MAINSTAGE", 80), // leaves early at minute 80
      slot("next", 90, 150, "s2", "CAGE"),
    ];
    const tl = buildPlanTimeline(slots, travel, 100 * MIN);
    const [long, gap] = tl.items as [PlanSetItem, PlanGapItem];

    expect(long.endMs).toBe(80 * MIN); // cut, not 180
    expect(long.status).toBe("done"); // now=100 is past the cut
    // gap from 80→90 = 10 min, walk 8 → break 2 (< threshold) but the walk still shows.
    expect(gap).toMatchObject({ kind: "gap", walkMinutes: 8, breakMinutes: 2 });
    expect(tl.breakCount).toBe(0);
  });

  it("is empty for no slots and gap-free for a single set", () => {
    expect(buildPlanTimeline([], travel, 0)).toEqual({ items: [], setCount: 0, breakCount: 0 });
    const one = buildPlanTimeline([slot("solo", 0, 60, "s1", "MAINSTAGE")], travel, 0);
    expect(one.items).toHaveLength(1);
    expect(one.items[0]!.kind).toBe("set");
  });
});
