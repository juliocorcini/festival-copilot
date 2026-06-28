// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ArtistDto, LineupDto, PerformanceDto } from "../data/types";
import {
  countFavoritesPerDay,
  dayOfMonth,
  daysForWeekends,
  initials,
  pickActiveDay,
  weekendDates,
  type DayInfo,
} from "./festival";

describe("initials", () => {
  it("takes first + last initials, single words, and handles empties", () => {
    expect(initials("Charlotte de Witte")).toBe("CW");
    expect(initials("Solomun")).toBe("SO");
    expect(initials("")).toBe("?");
    expect(initials("Tale Of Us")).toBe("TU");
  });
});

describe("pickActiveDay", () => {
  const days = [
    { key: "FRIDAY", startMs: 100 },
    { key: "SATURDAY", startMs: 200 },
    { key: "SUNDAY", startMs: 300 },
  ];

  it("returns null for an empty list", () => {
    expect(pickActiveDay([], 150)).toBeNull();
  });

  it("returns the first day before the festival has started", () => {
    expect(pickActiveDay(days, 50)?.key).toBe("FRIDAY");
  });

  it("returns the latest day whose first set has already started", () => {
    expect(pickActiveDay(days, 150)?.key).toBe("FRIDAY");
    expect(pickActiveDay(days, 250)?.key).toBe("SATURDAY");
    expect(pickActiveDay(days, 9999)?.key).toBe("SUNDAY");
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

function artist(id: string): ArtistDto {
  return { id, name: id, imageUrl: null };
}

function day(key: string): DayInfo {
  return { key, weekendId: null, startMs: 0, weekdayShort: key, weekdayLong: key, dateLabel: "" };
}

describe("countFavoritesPerDay (DAY-2)", () => {
  const days = [day("FRIDAY"), day("SATURDAY"), day("SUNDAY")];

  it("counts a favorited act once on each day it plays", () => {
    const performances = [
      perf({ id: "p1", day: "FRIDAY", artists: [artist("afrojack")] }),
      perf({ id: "p2", day: "SATURDAY", artists: [artist("afrojack")] }),
    ];
    const counts = countFavoritesPerDay(performances, new Set(["afrojack"]), days);
    expect(counts.get("FRIDAY")).toBe(1);
    expect(counts.get("SATURDAY")).toBe(1);
  });

  it("ignores non-favorited acts", () => {
    const performances = [
      perf({ id: "p1", day: "FRIDAY", artists: [artist("afrojack")] }),
      perf({ id: "p2", day: "FRIDAY", artists: [artist("stranger")] }),
    ];
    const counts = countFavoritesPerDay(performances, new Set(["afrojack"]), days);
    expect(counts.get("FRIDAY")).toBe(1);
  });

  it("omits days with no favorites from the map", () => {
    const performances = [perf({ id: "p1", day: "FRIDAY", artists: [artist("afrojack")] })];
    const counts = countFavoritesPerDay(performances, new Set(["afrojack"]), days);
    expect(counts.has("SATURDAY")).toBe(false);
    expect(counts.has("SUNDAY")).toBe(false);
    expect(counts.size).toBe(1);
  });

  it("counts the same act twice in one day only once", () => {
    const performances = [
      perf({ id: "p1", day: "FRIDAY", artists: [artist("afrojack")] }),
      perf({ id: "p2", day: "FRIDAY", artists: [artist("afrojack")] }),
    ];
    const counts = countFavoritesPerDay(performances, new Set(["afrojack"]), days);
    expect(counts.get("FRIDAY")).toBe(1);
  });

  it("counts distinct favorited acts per day", () => {
    const performances = [
      perf({ id: "p1", day: "SATURDAY", artists: [artist("afrojack")] }),
      perf({ id: "p2", day: "SATURDAY", artists: [artist("charlotte")] }),
      perf({ id: "p3", day: "SATURDAY", artists: [artist("amelie")] }),
    ];
    const counts = countFavoritesPerDay(performances, new Set(["afrojack", "charlotte", "amelie"]), days);
    expect(counts.get("SATURDAY")).toBe(3);
  });

  it("excludes performances on days outside the provided day list", () => {
    const performances = [perf({ id: "p1", day: "MONDAY", artists: [artist("afrojack")] })];
    const counts = countFavoritesPerDay(performances, new Set(["afrojack"]), days);
    expect(counts.size).toBe(0);
  });

  it("falls back to the performance id when the act has no artist", () => {
    const performances = [perf({ id: "p1", day: "SUNDAY", artists: [] })];
    const counts = countFavoritesPerDay(performances, new Set(["p1"]), days);
    expect(counts.get("SUNDAY")).toBe(1);
  });
});

describe("dayOfMonth (DAY-1)", () => {
  it("formats the day-of-month in the festival tz", () => {
    const ms = Date.parse("2026-07-25T20:00:00Z");
    expect(dayOfMonth(ms, "Europe/Brussels")).toBe("25");
  });

  it("returns an empty string for a non-finite start", () => {
    expect(dayOfMonth(Number.POSITIVE_INFINITY, "UTC")).toBe("");
  });
});
