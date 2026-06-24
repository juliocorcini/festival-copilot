import { describe, it, expect } from "vitest";
import { setsAtStage, stageProgrammeAt } from "./stageProgramme";
import type { PlannableSet } from "./types";

const T = (h: number, m = 0): number => Date.UTC(2026, 6, 24, h, m); // Jul 24 2026, UTC

function set(id: string, stageName: string, startH: number, endH: number, label = id): PlannableSet {
  return {
    id,
    actKey: id,
    label,
    stageId: stageName,
    stageName,
    startMs: T(startH),
    endMs: T(endH),
    day: "FRIDAY",
    weekendId: "w1",
  };
}

const sets: PlannableSet[] = [
  set("a", "MAINSTAGE", 18, 19, "Alpha"),
  set("b", "MAINSTAGE", 19, 20, "Bravo"),
  set("c", "MAINSTAGE", 21, 22, "Charlie"),
  set("d", "CORE", 18, 20, "Delta"),
];

describe("setsAtStage", () => {
  it("filters to one stage, case-insensitively, sorted by start", () => {
    const main = setsAtStage(sets, "mainstage");
    expect(main.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("returns nothing for an unknown stage", () => {
    expect(setsAtStage(sets, "THE RAVE CAVE")).toEqual([]);
  });
});

describe("stageProgrammeAt", () => {
  it("resolves the live set and the next at a stage", () => {
    const p = stageProgrammeAt(sets, "MAINSTAGE", T(19, 30)); // during Bravo
    expect(p.now?.label).toBe("Bravo");
    expect(p.next?.label).toBe("Charlie");
  });

  it("has no `now` during a gap but still finds the next", () => {
    const p = stageProgrammeAt(sets, "MAINSTAGE", T(20, 30)); // between Bravo (ends 20) and Charlie (21)
    expect(p.now).toBeNull();
    expect(p.next?.label).toBe("Charlie");
  });

  it("treats the end instant as not-playing (exclusive end)", () => {
    const p = stageProgrammeAt(sets, "MAINSTAGE", T(19)); // Alpha ends exactly at 19, Bravo starts at 19
    expect(p.now?.label).toBe("Bravo");
  });

  it("returns null/null once the stage is done for the night", () => {
    const p = stageProgrammeAt(sets, "MAINSTAGE", T(23));
    expect(p.now).toBeNull();
    expect(p.next).toBeNull();
  });

  it("is independent per stage", () => {
    const core = stageProgrammeAt(sets, "CORE", T(19));
    expect(core.now?.label).toBe("Delta");
    expect(core.next).toBeNull();
  });
});
