// @vitest-environment node
import { describe, expect, it } from "vitest";
import { effectiveEnd, effectiveInterval, effectiveStart } from "./planSlot";
import type { PlanSlot } from "./types";

const MIN = 60_000;
// A scheduled 12:00–14:00 set, in minutes-since-epoch so the math reads cleanly.
function slot(over: Partial<PlanSlot> = {}): PlanSlot {
  return {
    setId: "s",
    actKey: "s",
    label: "s",
    stageId: "main",
    stageName: "MAINSTAGE",
    startMs: 720 * MIN, // 12:00
    endMs: 840 * MIN, // 14:00
    cutMs: null,
    ...over,
  };
}

describe("effectiveStart (arrive-late, DEC-074)", () => {
  it("uses the scheduled start when there is no late arrival", () => {
    expect(effectiveStart(slot())).toBe(720 * MIN);
    expect(effectiveStart(slot({ lateStartMs: null }))).toBe(720 * MIN);
  });

  it("honors a late arrival strictly inside the set", () => {
    expect(effectiveStart(slot({ lateStartMs: 750 * MIN }))).toBe(750 * MIN); // arrive 12:30
  });

  it("ignores a late arrival at or before the scheduled start (must be strictly later)", () => {
    expect(effectiveStart(slot({ lateStartMs: 720 * MIN }))).toBe(720 * MIN); // == start
    expect(effectiveStart(slot({ lateStartMs: 700 * MIN }))).toBe(720 * MIN); // before start
  });

  it("ignores a late arrival at or after the scheduled end", () => {
    expect(effectiveStart(slot({ lateStartMs: 840 * MIN }))).toBe(720 * MIN); // == end
    expect(effectiveStart(slot({ lateStartMs: 900 * MIN }))).toBe(720 * MIN); // after end
  });
});

describe("effectiveEnd (leave-early partial set, DEC-018)", () => {
  it("uses the scheduled end when there is no cut", () => {
    expect(effectiveEnd(slot())).toBe(840 * MIN);
    expect(effectiveEnd(slot({ cutMs: null }))).toBe(840 * MIN);
  });

  it("honors a cut strictly inside the set", () => {
    expect(effectiveEnd(slot({ cutMs: 810 * MIN }))).toBe(810 * MIN); // leave 13:30
  });

  it("ignores a cut at or before the scheduled start", () => {
    expect(effectiveEnd(slot({ cutMs: 720 * MIN }))).toBe(840 * MIN); // == start
    expect(effectiveEnd(slot({ cutMs: 600 * MIN }))).toBe(840 * MIN); // before start
  });

  it("ignores a cut at or after the scheduled end (must be strictly earlier)", () => {
    expect(effectiveEnd(slot({ cutMs: 840 * MIN }))).toBe(840 * MIN); // == end
    expect(effectiveEnd(slot({ cutMs: 900 * MIN }))).toBe(840 * MIN); // after end
  });
});

describe("effectiveInterval", () => {
  it("applies both travel choices independently", () => {
    const s = slot({ lateStartMs: 750 * MIN, cutMs: 810 * MIN });
    expect(effectiveInterval(s)).toEqual({ startMs: 750 * MIN, endMs: 810 * MIN });
  });

  it("falls back to the scheduled window when neither choice is valid", () => {
    const s = slot({ lateStartMs: 700 * MIN, cutMs: 900 * MIN }); // both out of range
    expect(effectiveInterval(s)).toEqual({ startMs: 720 * MIN, endMs: 840 * MIN });
  });

  it("validates each bound against the SCHEDULED window, not against each other", () => {
    // A late start (13:30) past a cut (12:30): each is in (start, end), so both apply, yielding an
    // inverted window. Intentional — the two choices are independent; a caller reads start >= end as
    // "not actually attending". Pinned so any future clamping is a conscious change.
    const s = slot({ lateStartMs: 810 * MIN, cutMs: 750 * MIN });
    expect(effectiveInterval(s)).toEqual({ startMs: 810 * MIN, endMs: 750 * MIN });
  });
});
