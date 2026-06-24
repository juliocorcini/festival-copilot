// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildNowNext } from "./nowNext";
import { flatTravelMatrix } from "./partialSet";
import type { PlanSlot } from "./types";

const MIN = 60_000;
const travel = flatTravelMatrix(6); // 6 min between different stages, 0 same

function slot(setId: string, startMin: number, endMin: number, stageId: string, cutMin: number | null = null): PlanSlot {
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

const plan = [slot("a", 0, 60, "s1"), slot("b", 70, 130, "s2"), slot("c", 200, 260, "s3")];

describe("buildNowNext", () => {
  it("during a set: live + next + leave-in (start − walk − now) + progress", () => {
    const m = buildNowNext(plan, travel, 30 * MIN);
    expect(m.live?.setId).toBe("a");
    expect(m.next?.setId).toBe("b");
    expect(m.walkMinutes).toBe(6);
    expect(m.leaveInMinutes).toBe(34); // 70 − 6 − 30
    expect(m.progress).toBeCloseTo(0.5, 5);
    expect(m.later.map((s) => s.setId)).toEqual(["c"]);
  });

  it("in a gap: no live, leave-in can go negative (already late)", () => {
    const m = buildNowNext(plan, travel, 65 * MIN);
    expect(m.live).toBeNull();
    expect(m.next?.setId).toBe("b");
    expect(m.leaveInMinutes).toBe(-1); // 70 − 6 − 65
    expect(m.progress).toBe(0);
  });

  it("honors a partial-set cut for the live window and progress", () => {
    const cut = [slot("a", 0, 60, "s1", 40), slot("b", 70, 130, "s2")];
    expect(buildNowNext(cut, travel, 30 * MIN).live?.setId).toBe("a"); // 30 < cut(40)
    expect(buildNowNext(cut, travel, 30 * MIN).progress).toBeCloseTo(0.75, 5); // 30/40
    expect(buildNowNext(cut, travel, 45 * MIN).live).toBeNull(); // 45 ≥ cut(40)
  });

  it("after the last set: nothing live or next", () => {
    const m = buildNowNext(plan, travel, 300 * MIN);
    expect(m.live).toBeNull();
    expect(m.next).toBeNull();
    expect(m.leaveInMinutes).toBeNull();
    expect(m.later).toEqual([]);
  });
});
