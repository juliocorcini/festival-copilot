// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PerformanceDto } from "../data/types";
import { assignFestivalDays, festivalDayIdByPerformanceId } from "./festivalDay";

function perf(over: Partial<PerformanceDto>): PerformanceDto {
  return {
    id: "p",
    sourcePerformanceId: "sp",
    name: "Act",
    day: "FRIDAY",
    dateLocal: "2026-07-17",
    weekendId: "w1",
    stageId: "s1",
    startAtUtc: "2026-07-17T18:00:00.000Z",
    endAtUtc: "2026-07-17T19:00:00.000Z",
    isPlaceholder: false,
    artists: [],
    ...over,
  };
}

const ms = (iso: string): number => Date.parse(iso);

describe("assignFestivalDays", () => {
  it("keeps a post-midnight set with its night and crosses midnight in the window", () => {
    const days = assignFestivalDays([
      perf({ id: "a", day: "FRIDAY", startAtUtc: "2026-07-17T20:00:00.000Z", endAtUtc: "2026-07-17T21:00:00.000Z" }),
      perf({ id: "b", day: "FRIDAY", startAtUtc: "2026-07-17T22:30:00.000Z", endAtUtc: "2026-07-17T23:30:00.000Z" }),
      // Source mis-labels this after-midnight set by civil date; it belongs to Friday night.
      perf({ id: "c", day: "SATURDAY", startAtUtc: "2026-07-17T23:45:00.000Z", endAtUtc: "2026-07-18T00:45:00.000Z" }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]!.id).toBe("FRIDAY"); // plurality (2 FRIDAY vs 1 SATURDAY)
    expect(days[0]!.startMs).toBe(ms("2026-07-17T20:00:00Z"));
    expect(days[0]!.endMs).toBe(ms("2026-07-18T00:45:00Z")); // window runs past midnight
    expect(days[0]!.performanceIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("splits exactly at the 3-hour gap boundary, but a 2h59 gap stays one night", () => {
    const split = assignFestivalDays([
      perf({ id: "x", startAtUtc: "2026-07-17T18:00:00.000Z", endAtUtc: "2026-07-17T19:00:00.000Z" }),
      perf({ id: "y", startAtUtc: "2026-07-17T22:00:00.000Z", endAtUtc: "2026-07-17T23:00:00.000Z" }), // gap = 3h00
    ]);
    expect(split.map((d) => d.performanceIds)).toEqual([["x"], ["y"]]);

    const joined = assignFestivalDays([
      perf({ id: "x", startAtUtc: "2026-07-17T18:00:00.000Z", endAtUtc: "2026-07-17T19:00:00.000Z" }),
      perf({ id: "y", startAtUtc: "2026-07-17T21:59:00.000Z", endAtUtc: "2026-07-17T22:59:00.000Z" }), // gap = 2h59
    ]);
    expect(joined).toHaveLength(1);
    expect(joined[0]!.performanceIds.sort()).toEqual(["x", "y"]);
  });

  it("uses the running max-end across stages so a long set's tail holds the block together", () => {
    // 'after' starts 4.5h after 'main' ends but only 0.5h after the long 'tail' on another stage ends.
    const days = assignFestivalDays([
      perf({ id: "main", stageId: "s1", startAtUtc: "2026-07-17T18:00:00.000Z", endAtUtc: "2026-07-17T19:00:00.000Z" }),
      perf({ id: "tail", stageId: "s2", startAtUtc: "2026-07-17T18:30:00.000Z", endAtUtc: "2026-07-17T23:00:00.000Z" }),
      perf({ id: "after", stageId: "s1", startAtUtc: "2026-07-17T23:30:00.000Z", endAtUtc: "2026-07-18T00:30:00.000Z" }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]!.performanceIds.sort()).toEqual(["after", "main", "tail"]);
  });

  it("outvotes a mis-tagged stray by plurality and pulls it into the night it actually plays", () => {
    const days = assignFestivalDays([
      perf({ id: "f1", day: "FRIDAY", startAtUtc: "2026-07-17T20:00:00.000Z", endAtUtc: "2026-07-17T21:00:00.000Z" }),
      perf({ id: "s1", day: "SATURDAY", startAtUtc: "2026-07-18T18:00:00.000Z", endAtUtc: "2026-07-18T19:00:00.000Z" }),
      // Mis-tagged FRIDAY but it plays Saturday night — must land in the Saturday block.
      perf({ id: "stray", day: "FRIDAY", startAtUtc: "2026-07-18T19:30:00.000Z", endAtUtc: "2026-07-18T20:30:00.000Z" }),
      perf({ id: "s2", day: "SATURDAY", startAtUtc: "2026-07-18T21:00:00.000Z", endAtUtc: "2026-07-18T22:00:00.000Z" }),
    ]);
    expect(days).toHaveLength(2);
    expect(days[0]!.id).toBe("FRIDAY");
    expect(days[0]!.performanceIds).toEqual(["f1"]);
    expect(days[1]!.id).toBe("SATURDAY");
    expect(days[1]!.performanceIds.sort()).toEqual(["s1", "s2", "stray"]);
  });

  it("keeps block ids equal to a source day label, so persisted plan keys survive", () => {
    const labels = new Set(["FRIDAY", "SATURDAY", "SUNDAY"]);
    const days = assignFestivalDays([
      perf({ id: "a", day: "FRIDAY", startAtUtc: "2026-07-17T20:00:00.000Z", endAtUtc: "2026-07-17T21:00:00.000Z" }),
      perf({ id: "b", day: "SATURDAY", startAtUtc: "2026-07-18T20:00:00.000Z", endAtUtc: "2026-07-18T21:00:00.000Z" }),
    ]);
    for (const day of days) expect(labels.has(day.id)).toBe(true);
  });

  it("ignores placeholders and time-less performances", () => {
    const days = assignFestivalDays([
      perf({ id: "real", startAtUtc: "2026-07-17T20:00:00.000Z", endAtUtc: "2026-07-17T21:00:00.000Z" }),
      perf({ id: "ph", isPlaceholder: true, startAtUtc: "2026-07-17T20:00:00.000Z", endAtUtc: "2026-07-17T21:00:00.000Z" }),
      perf({ id: "notime", startAtUtc: null, endAtUtc: null }),
    ]);
    expect(days).toHaveLength(1);
    expect(days[0]!.performanceIds).toEqual(["real"]);
  });
});

describe("festivalDayIdByPerformanceId", () => {
  it("maps every plannable performance to its festival-day id", () => {
    const map = festivalDayIdByPerformanceId([
      perf({ id: "f1", day: "FRIDAY", startAtUtc: "2026-07-17T20:00:00.000Z", endAtUtc: "2026-07-17T21:00:00.000Z" }),
      perf({ id: "s1", day: "SATURDAY", startAtUtc: "2026-07-18T18:00:00.000Z", endAtUtc: "2026-07-18T19:00:00.000Z" }),
      perf({ id: "stray", day: "FRIDAY", startAtUtc: "2026-07-18T19:30:00.000Z", endAtUtc: "2026-07-18T20:30:00.000Z" }),
      perf({ id: "s2", day: "SATURDAY", startAtUtc: "2026-07-18T21:00:00.000Z", endAtUtc: "2026-07-18T22:00:00.000Z" }),
    ]);
    expect(map.get("f1")).toBe("FRIDAY");
    expect(map.get("stray")).toBe("SATURDAY"); // re-homed by time; SATURDAY is the block plurality
    expect(map.get("s2")).toBe("SATURDAY");
  });
});
