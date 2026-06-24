// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { LineupDto, PerformanceDto } from "../data/types";
import { daysForWeekends, initials, weekendDates } from "./festival";

describe("initials", () => {
  it("takes first + last initials, single words, and handles empties", () => {
    expect(initials("Charlotte de Witte")).toBe("CW");
    expect(initials("Solomun")).toBe("SO");
    expect(initials("")).toBe("?");
    expect(initials("Tale Of Us")).toBe("TU");
  });
});

describe("weekendDates", () => {
  it("formats same-month, cross-month and start-only ranges", () => {
    expect(weekendDates({ id: "w1", name: "Weekend 1", startDate: "2026-07-17", endDate: "2026-07-19" })).toBe("Jul 17 – 19");
    expect(weekendDates({ id: "w2", name: "x", startDate: "2026-07-31", endDate: "2026-08-02" })).toBe("Jul 31 – Aug 2");
    expect(weekendDates({ id: "w3", name: "x", startDate: "2026-07-17", endDate: null })).toBe("Jul 17");
  });

  it("parses the API's 'YYYY-MM-DD HH:MM' shape and rolls early-morning ends back a night", () => {
    // Live API format; end is 01:00 (the 20th early morning) → belongs to the 19th.
    expect(weekendDates({ id: "w1", name: "W1", startDate: "2026-07-16 12:00", endDate: "2026-07-20 01:00" })).toBe("Jul 16 – 19");
    expect(weekendDates({ id: "w2", name: "W2", startDate: "2026-07-23 12:00", endDate: "2026-07-27 01:00" })).toBe("Jul 23 – 26");
  });

  it("never throws on malformed dates (returns empty)", () => {
    expect(weekendDates({ id: "x", name: "x", startDate: "not-a-date", endDate: null })).toBe("");
    expect(weekendDates({ id: "x", name: "x", startDate: null, endDate: "2026-07-19" })).toBe("");
  });
});

function perf(over: Partial<PerformanceDto>): PerformanceDto {
  return {
    id: "p", sourcePerformanceId: "sp", name: "A", day: "d1", dateLocal: "2026-07-17", weekendId: "w1",
    stageId: "s1", startAtUtc: "2026-07-17T18:00:00.000Z", endAtUtc: "2026-07-17T19:00:00.000Z",
    isPlaceholder: false, artists: [], ...over,
  };
}

const lineup: LineupDto = {
  festival: { id: "tml", name: "Tomorrowland", slug: "tml", timezone: "Europe/Brussels", revision: 1, withTimetable: true },
  weekends: [
    { id: "w1", name: "Weekend 1", startDate: "2026-07-17", endDate: "2026-07-19" },
    { id: "w2", name: "Weekend 2", startDate: "2026-07-24", endDate: "2026-07-26" },
  ],
  stages: [{ id: "s1", sourceStageId: "1", name: "MAINSTAGE", sortOrder: 0 }],
  performances: [
    perf({ id: "p2", day: "d2", weekendId: "w1", startAtUtc: "2026-07-18T14:00:00.000Z" }),
    perf({ id: "p1", day: "d1", weekendId: "w1", startAtUtc: "2026-07-17T18:00:00.000Z" }),
    perf({ id: "p3", day: "d3", weekendId: "w2", startAtUtc: "2026-07-24T16:00:00.000Z" }),
  ],
  hasLineup: true,
  hasTimetable: true,
};

describe("daysForWeekends", () => {
  it("returns only the chosen weekend's days, ordered by first set, with festival-tz labels", () => {
    const days = daysForWeekends(lineup, ["w1"]);
    expect(days.map((d) => d.key)).toEqual(["d1", "d2"]);
    expect(days[0]!.weekdayShort).toBe("Fri");
    expect(days[0]!.dateLabel).toBe("Jul 17");
    expect(days[1]!.weekdayShort).toBe("Sat");
  });

  it("includes every weekend's days when no weekend filter is given", () => {
    expect(daysForWeekends(lineup, []).map((d) => d.key)).toEqual(["d1", "d2", "d3"]);
  });
});
