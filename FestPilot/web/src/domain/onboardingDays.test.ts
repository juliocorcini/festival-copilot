import { describe, expect, it } from "vitest";
import type { Act } from "./lineup";
import { actDayIndex, dayProgressAt, groupActsByDay } from "./onboardingDays";

function act(label: string, days: string[]): Act {
  return { actKey: label, label, imageUrl: null, performances: [], stageIds: [], days };
}

describe("onboardingDays — per-day grouping (R5.3, DEC-048/026)", () => {
  const dayKeys = ["d1", "d2", "d3"];

  it("places a multi-day act once, under the earliest in-scope day", () => {
    const map = new Map(dayKeys.map((k, i) => [k, i]));
    expect(actDayIndex(act("X", ["d3", "d1"]), map)).toBe(0);
    expect(actDayIndex(act("Y", ["d2"]), map)).toBe(1);
    // No in-scope day → sorts last (== dayKeys.length).
    expect(actDayIndex(act("Z", ["unknown"]), map)).toBe(3);
  });

  it("orders acts into contiguous day blocks, alphabetical within a day", () => {
    const acts = [act("Bravo", ["d2"]), act("Alpha", ["d1"]), act("Charlie", ["d1", "d3"]), act("Delta", ["d2"])];
    const { orderedActs, groups } = groupActsByDay(acts, dayKeys);
    expect(orderedActs.map((a) => a.label)).toEqual(["Alpha", "Charlie", "Bravo", "Delta"]);
    // Day 1: Alpha + Charlie (Charlie plays d1+d3 but appears under d1); Day 2: Bravo + Delta.
    expect(groups).toEqual([
      { dayIndex: 0, start: 0, count: 2 },
      { dayIndex: 1, start: 2, count: 2 },
    ]);
  });

  it("reports per-day progress and clamps when finished", () => {
    const { groups } = groupActsByDay(
      [act("A", ["d1"]), act("B", ["d1"]), act("C", ["d2"])],
      dayKeys
    );
    // Start of day 1 → 0%.
    expect(dayProgressAt(groups, 0)).toMatchObject({ ordinal: 1, totalDays: 2, withinDay: 0, dayCount: 2, pct: 0 });
    // Halfway through day 1 → 50%.
    expect(dayProgressAt(groups, 1)).toMatchObject({ ordinal: 1, withinDay: 1, pct: 50 });
    // Into day 2.
    expect(dayProgressAt(groups, 2)).toMatchObject({ ordinal: 2, dayCount: 1, pct: 0 });
    // Past the end → clamp to last day fully done.
    expect(dayProgressAt(groups, 9)).toMatchObject({ ordinal: 2, withinDay: 1, pct: 100 });
  });

  it("returns null progress when there are no acts", () => {
    expect(dayProgressAt([], 0)).toBeNull();
  });
});
