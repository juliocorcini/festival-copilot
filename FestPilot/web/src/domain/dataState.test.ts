import { describe, expect, it } from "vitest";
import { festivalDataState, showsViewSwitch } from "./dataState";

describe("festivalDataState (DEC-052)", () => {
  it("nothing announced → 'nothing'", () => {
    expect(festivalDataState(false, false)).toBe("nothing");
  });

  it("acts announced but no timetable → 'lineup_only'", () => {
    expect(festivalDataState(true, false)).toBe("lineup_only");
  });

  it("timetable published → 'timetable'", () => {
    expect(festivalDataState(true, true)).toBe("timetable");
  });

  it("timetable flag wins even if hasLineup were somehow false (defensive)", () => {
    expect(festivalDataState(false, true)).toBe("timetable");
  });

  it("the Timetable⇄Lineup switch only shows when there's a timetable", () => {
    expect(showsViewSwitch("timetable")).toBe(true);
    expect(showsViewSwitch("lineup_only")).toBe(false);
    expect(showsViewSwitch("nothing")).toBe(false);
  });
});
