// @vitest-environment node
import { describe, expect, it } from "vitest";
import { evaluateTransition, flatTravelMatrix, latestFeasibleDeparture } from "./partialSet";
import type { PlanSlot } from "./types";

const MIN = 60_000;
function slot(id: string, startMin: number, endMin: number, stageId: string): PlanSlot {
  return {
    setId: id,
    actKey: id,
    label: id,
    stageId,
    stageName: stageId,
    startMs: startMin * MIN,
    endMs: endMin * MIN,
    cutMs: null,
  };
}

describe("evaluateTransition", () => {
  const travel = flatTravelMatrix(8);

  it("is feasible with slack when stages are far enough apart in time", () => {
    const from = slot("A", 0, 60, "main");
    const to = slot("B", 80, 140, "cage");
    const result = evaluateTransition(from, to, travel);
    expect(result.feasible).toBe(true);
    expect(result.walkMinutes).toBe(8);
    expect(result.cutMinutes).toBe(0);
    expect(result.slackMinutes).toBe(12); // leave at 60, walk 8 → arrive 68, B at 80.
  });

  it("requires an early cut when the next set starts before the walk allows", () => {
    const from = slot("A", 0, 60, "main");
    const to = slot("B", 64, 140, "cage"); // only 4 min gap, need 8 → must cut 4 min.
    const full = evaluateTransition(from, to, travel);
    expect(full.feasible).toBe(false);

    const cut = evaluateTransition(from, to, travel, 56 * MIN); // leave 4 min early.
    expect(cut.feasible).toBe(true);
    expect(cut.cutMinutes).toBe(4);
    expect(cut.slackMinutes).toBe(0);
  });

  it("is free (0 walk) when staying on the same stage", () => {
    const result = evaluateTransition(slot("A", 0, 60, "main"), slot("B", 60, 120, "main"), travel);
    expect(result.walkMinutes).toBe(0);
    expect(result.feasible).toBe(true);
  });
});

describe("latestFeasibleDeparture", () => {
  it("returns the latest cut that still makes the next set, or null when impossible", () => {
    const travel = flatTravelMatrix(10);
    const from = slot("A", 0, 60, "main");
    expect(latestFeasibleDeparture(from, slot("B", 80, 140, "cage"), travel)).toBe(60 * MIN); // can stay to the end.
    expect(latestFeasibleDeparture(from, slot("B", 64, 140, "cage"), travel)).toBe(54 * MIN); // leave at 54.
    expect(latestFeasibleDeparture(from, slot("B", 5, 140, "cage"), travel)).toBeNull(); // unreachable.
  });
});
