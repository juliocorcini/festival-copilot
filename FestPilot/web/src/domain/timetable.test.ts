// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PerformanceDto, StageDto } from "../data/types";
import { buildTimetable, tzOffsetMinutes } from "./timetable";

const stages: StageDto[] = [
  { id: "s2", sourceStageId: "2", name: "FREEDOM", sortOrder: 1 },
  { id: "s1", sourceStageId: "1", name: "MAINSTAGE", sortOrder: 0 },
];

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

// A 4-hour window (18:00–22:00 UTC) so percentages are exact: each hour = 25%.
const performances: PerformanceDto[] = [
  perf({ id: "a1", stageId: "s1", artists: [{ id: "cw", name: "Charlotte de Witte", imageUrl: null }], startAtUtc: "2026-07-17T18:00:00.000Z", endAtUtc: "2026-07-17T19:00:00.000Z" }),
  perf({ id: "a2", stageId: "s1", artists: [{ id: "sa", name: "Steve Aoki", imageUrl: null }], startAtUtc: "2026-07-17T20:00:00.000Z", endAtUtc: "2026-07-17T22:00:00.000Z" }),
  perf({ id: "b1", stageId: "s2", artists: [{ id: "ab", name: "Adam Beyer", imageUrl: null }], startAtUtc: "2026-07-17T18:30:00.000Z", endAtUtc: "2026-07-17T19:30:00.000Z" }),
  perf({ id: "ph", stageId: "s2", isPlaceholder: true, startAtUtc: "2026-07-17T18:00:00.000Z", endAtUtc: "2026-07-17T19:00:00.000Z" }),
  perf({ id: "sat", stageId: "s1", day: "SATURDAY", startAtUtc: "2026-07-18T18:00:00.000Z", endAtUtc: "2026-07-18T19:00:00.000Z" }),
];

describe("tzOffsetMinutes", () => {
  it("is zero for UTC and +120 for Brussels in July (CEST)", () => {
    expect(tzOffsetMinutes(Date.parse("2026-07-17T12:00:00Z"), "UTC")).toBe(0);
    expect(tzOffsetMinutes(Date.parse("2026-07-17T12:00:00Z"), "Europe/Brussels")).toBe(120);
  });
});

describe("buildTimetable", () => {
  const model = buildTimetable({ performances, stages, favorites: new Set(["sa"]), dayKey: "FRIDAY", weekendIds: ["w1"], timeZone: "UTC" });

  it("snaps the window to whole hours and excludes other days + placeholders", () => {
    expect(model.isEmpty).toBe(false);
    expect(model.windowStartMs).toBe(Date.parse("2026-07-17T18:00:00Z"));
    expect(model.windowEndMs).toBe(Date.parse("2026-07-17T22:00:00Z"));
    expect(model.totalHours).toBe(4);
    expect(model.hourMarks.map((h) => h.leftPct)).toEqual([0, 25, 50, 75, 100]);
  });

  it("orders stages by sortOrder and positions sets as time percentages", () => {
    expect(model.stages.map((s) => s.name)).toEqual(["MAINSTAGE", "FREEDOM"]);
    const main = model.stages[0]!;
    expect(main.sets.map((s) => s.id)).toEqual(["a1", "a2"]);
    expect(main.sets[0]).toMatchObject({ leftPct: 0, widthPct: 25 }); // 18:00–19:00
    expect(main.sets[1]).toMatchObject({ leftPct: 50, widthPct: 50 }); // 20:00–22:00
    const freedom = model.stages[1]!;
    expect(freedom.sets[0]).toMatchObject({ id: "b1", leftPct: 12.5, widthPct: 25 }); // 18:30–19:30
    // The placeholder set on FREEDOM is dropped.
    expect(freedom.sets).toHaveLength(1);
  });

  it("flags favorites at the set and stage level", () => {
    const main = model.stages[0]!;
    expect(main.hasFav).toBe(true);
    expect(main.sets.find((s) => s.id === "a2")!.isFav).toBe(true);
    expect(main.sets.find((s) => s.id === "a1")!.isFav).toBe(false);
    expect(model.stages[1]!.hasFav).toBe(false);
  });

  it("is empty for a day with no sets", () => {
    const empty = buildTimetable({ performances, stages, favorites: new Set(), dayKey: "SUNDAY", weekendIds: ["w1"], timeZone: "UTC" });
    expect(empty.isEmpty).toBe(true);
    expect(empty.stages).toHaveLength(0);
  });
});
