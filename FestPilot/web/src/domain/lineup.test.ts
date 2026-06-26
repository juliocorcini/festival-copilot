// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PerformanceDto, StageDto } from "../data/types";
import {
  actKey,
  actLabel,
  favoriteSets,
  imageByActKey,
  nearbySets,
  performancesForWeekends,
  toPlannableSets,
  uniqueActs,
} from "./lineup";

const stages: StageDto[] = [
  { id: "stage-main", sourceStageId: "1", name: "MAINSTAGE", sortOrder: 0 },
  { id: "stage-cage", sourceStageId: "2", name: "CAGE", sortOrder: 1 },
];

function perf(over: Partial<PerformanceDto>): PerformanceDto {
  return {
    id: "p-1",
    sourcePerformanceId: "sp-1",
    name: "Artist",
    day: "D1",
    dateLocal: "2026-07-18",
    weekendId: "W1",
    stageId: "stage-main",
    startAtUtc: "2026-07-18T18:00:00.000Z",
    endAtUtc: "2026-07-18T19:00:00.000Z",
    isPlaceholder: false,
    artists: [{ id: "artist-1", name: "Artist", imageUrl: null }],
    ...over,
  };
}

describe("imageByActKey (R5.4 / DEC-061)", () => {
  it("maps actKey → first available photo, upgrading a null first sighting", () => {
    const noPhoto = perf({ id: "p-1", day: "D1", artists: [{ id: "a-x", name: "X", imageUrl: null }] });
    const withPhoto = perf({ id: "p-2", day: "D2", artists: [{ id: "a-x", name: "X", imageUrl: "https://cdn/x.jpg" }] });
    const map = imageByActKey([noPhoto, withPhoto]);
    expect(map.get("a-x")).toBe("https://cdn/x.jpg");
  });

  it("keeps null when an act never has a photo", () => {
    const map = imageByActKey([perf({ artists: [{ id: "a-y", name: "Y", imageUrl: null }] })]);
    expect(map.get("a-y")).toBeNull();
  });
});

describe("act identity", () => {
  it("keys by the first artist id and dedups an act playing multiple days", () => {
    const day1 = perf({ id: "p-1", day: "D1", artists: [{ id: "a-charlotte", name: "Charlotte de Witte", imageUrl: null }] });
    const day2 = perf({ id: "p-2", day: "D2", artists: [{ id: "a-charlotte", name: "Charlotte de Witte", imageUrl: null }] });
    expect(actKey(day1)).toBe("a-charlotte");
    const acts = uniqueActs([day1, day2]);
    expect(acts).toHaveLength(1);
    expect(acts[0]!.performances).toHaveLength(2);
    expect(acts[0]!.days.sort()).toEqual(["D1", "D2"]);
  });

  it("falls back to the unique performance id when no artist is resolved", () => {
    const tba1 = perf({ id: "p-9", name: "More to be announced", artists: [] });
    const tba2 = perf({ id: "p-10", name: "More to be announced", artists: [] });
    expect(actKey(tba1)).toBe("p-9");
    expect(actKey(tba2)).toBe("p-10");
  });

  it("labels from name, then artists, then a TBA fallback", () => {
    expect(actLabel(perf({ name: "Amelie Lens" }))).toBe("Amelie Lens");
    expect(actLabel(perf({ name: "", artists: [{ id: "x", name: "Solomun", imageUrl: null }] }))).toBe("Solomun");
    expect(actLabel(perf({ name: "", artists: [] }))).toBe("To be announced");
  });
});

describe("performancesForWeekends", () => {
  const w1 = perf({ id: "p-w1", weekendId: "W1", artists: [{ id: "a-1", name: "One", imageUrl: null }] });
  const w2 = perf({ id: "p-w2", weekendId: "W2", artists: [{ id: "a-2", name: "Two", imageUrl: null }] });
  const undated = perf({ id: "p-none", weekendId: undefined, artists: [{ id: "a-3", name: "Three", imageUrl: null }] });

  it("returns every performance when no weekend is selected", () => {
    expect(performancesForWeekends([w1, w2, undated], [])).toEqual([w1, w2, undated]);
  });

  it("keeps only performances of the chosen weekend (plus weekend-less ones)", () => {
    const result = performancesForWeekends([w1, w2, undated], ["W2"]);
    expect(result.map((p) => p.id)).toEqual(["p-w2", "p-none"]);
  });

  it("supports selecting multiple weekends", () => {
    const result = performancesForWeekends([w1, w2, undated], ["W1", "W2"]);
    expect(result.map((p) => p.id)).toEqual(["p-w1", "p-w2", "p-none"]);
  });
});

describe("uniqueActs", () => {
  it("excludes placeholders by default and sorts alphabetically", () => {
    const acts = uniqueActs([
      perf({ id: "p-z", name: "Zedd", artists: [{ id: "a-z", name: "Zedd", imageUrl: null }] }),
      perf({ id: "p-a", name: "Adam Beyer", artists: [{ id: "a-a", name: "Adam Beyer", imageUrl: null }] }),
      perf({ id: "p-tba", name: "More to be announced", isPlaceholder: true, artists: [] }),
    ]);
    expect(acts.map((a) => a.label)).toEqual(["Adam Beyer", "Zedd"]);
  });
});

describe("uniqueActs — socials propagation (ART-4)", () => {
  it("adopts the first non-empty socials across an act's performances", () => {
    const noSocials = perf({ id: "p-1", day: "D1", artists: [{ id: "a-x", name: "X", imageUrl: null }] });
    const withSocials = perf({
      id: "p-2",
      day: "D2",
      artists: [{ id: "a-x", name: "X", imageUrl: null, socials: { instagram: "https://ig/x" } }],
    });
    const act = uniqueActs([noSocials, withSocials])[0]!;
    expect(act.socials).toEqual({ instagram: "https://ig/x" });
  });

  it("leaves socials undefined for an act whose artist carries none", () => {
    const act = uniqueActs([perf({ artists: [{ id: "a-y", name: "Y", imageUrl: null }] })])[0]!;
    expect(act.socials).toBeUndefined();
  });
});

describe("toPlannableSets", () => {
  it("maps valid performances and resolves the stage name", () => {
    const sets = toPlannableSets([perf({ stageId: "stage-cage" })], stages);
    expect(sets).toHaveLength(1);
    expect(sets[0]!.stageName).toBe("CAGE");
    expect(sets[0]!.endMs - sets[0]!.startMs).toBe(60 * 60_000);
  });

  it("drops placeholders, missing times, and inverted windows", () => {
    expect(toPlannableSets([perf({ isPlaceholder: true })], stages)).toHaveLength(0);
    expect(toPlannableSets([perf({ startAtUtc: null })], stages)).toHaveLength(0);
    expect(
      toPlannableSets([perf({ startAtUtc: "2026-07-18T20:00:00Z", endAtUtc: "2026-07-18T19:00:00Z" })], stages)
    ).toHaveLength(0);
  });
});

describe("favoriteSets", () => {
  it("returns only sets whose act is favorited", () => {
    const a = perf({ id: "p-a", artists: [{ id: "a-a", name: "A", imageUrl: null }] });
    const b = perf({ id: "p-b", artists: [{ id: "a-b", name: "B", imageUrl: null }] });
    const result = favoriteSets([a, b], stages, new Set(["a-b"]));
    expect(result.map((s) => s.id)).toEqual(["p-b"]);
  });
});

describe("nearbySets", () => {
  const near = perf({ id: "p-near", artists: [{ id: "a-near", name: "Near", imageUrl: null }], startAtUtc: "2026-07-18T18:30:00.000Z", endAtUtc: "2026-07-18T19:30:00.000Z" });
  const far = perf({ id: "p-far", artists: [{ id: "a-far", name: "Far", imageUrl: null }], startAtUtc: "2026-07-18T23:00:00.000Z", endAtUtc: "2026-07-18T23:30:00.000Z" });
  const inWindow = perf({ id: "p-in", artists: [{ id: "a-in", name: "In", imageUrl: null }] }); // 18:00–19:00

  it("returns only acts overlapping the window, excluding given keys, sorted by start", () => {
    const window = { startMs: Date.parse("2026-07-18T18:00:00Z"), endMs: Date.parse("2026-07-18T19:00:00Z") };
    const result = nearbySets([far, near, inWindow], stages, window, { excludeActKeys: new Set(["a-in"]) });
    expect(result.map((s) => s.id)).toEqual(["p-near"]); // far is outside; in-window act excluded
  });

  it("filters by day when requested", () => {
    const window = { startMs: Date.parse("2026-07-18T18:00:00Z"), endMs: Date.parse("2026-07-18T20:00:00Z") };
    const otherDay = perf({ id: "p-d2", day: "D2", artists: [{ id: "a-d2", name: "D2", imageUrl: null }] });
    expect(nearbySets([inWindow, otherDay], stages, window, { dayKey: "D1" }).map((s) => s.id)).toEqual(["p-in"]);
  });
});
