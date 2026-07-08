import { describe, expect, it } from "vitest";
import type { PlannableSet } from "./types";
import type { SquadBlock } from "./squadPlan";
import { eventClashLabel, eventsForDay, mergeSquadTimeline, type TimelineEvent } from "./squadTimeline";

const at = (h: number, m = 0): number => Date.UTC(2026, 6, 18, h, m);
const iso = (h: number, m = 0): string => new Date(at(h, m)).toISOString();

function plannable(id: string, label: string, startH: number, endH: number): PlannableSet {
  return { id, actKey: label, label, stageId: null, stageName: "MAINSTAGE", startMs: at(startH), endMs: at(endH), day: null, weekendId: null };
}
function block(id: string, label: string, startH: number, endH: number): SquadBlock {
  return {
    set: plannable(id, label, startH, endH),
    going: [], goingCount: 0, splitCount: 0, split: [], method: "plurality",
    youStatus: "none", yourLock: null, fallback: null, pinned: false,
  };
}
function event(id: string, title: string, startH: number, endH: number): TimelineEvent {
  return { id, title, stageName: null, startsAtUtc: iso(startH), endsAtUtc: iso(endH) };
}

describe("mergeSquadTimeline (D23 — render-only)", () => {
  const blocks = [block("s1", "Adriatique", 18, 19), block("s2", "Tale of Us", 20, 21), block("s3", "Anyma", 22, 23)];
  const events = [event("e1", "Group photo", 19, 19), event("e2", "Dinner", 21, 22)];

  it("interleaves events between sets in start-time order", () => {
    const merged = mergeSquadTimeline(blocks, events);
    expect(merged.map((i) => (i.kind === "set" ? i.block.set.label : i.event.title))).toEqual([
      "Adriatique", // 18
      "Group photo", // 19
      "Tale of Us", // 20
      "Dinner", // 21
      "Anyma", // 22
    ]);
  });

  it("REGRESSION: events never enter the aggregation — filtering to sets returns the blocks unchanged", () => {
    const merged = mergeSquadTimeline(blocks, events);
    const setsBack = merged.filter((i) => i.kind === "set").map((i) => (i as { block: SquadBlock }).block);
    expect(setsBack).toEqual(blocks); // same blocks, same order, same identities
    expect(setsBack).toHaveLength(blocks.length);
  });

  it("keeps the set ahead of an event that starts at the same instant", () => {
    const merged = mergeSquadTimeline([block("s", "Charlotte", 20, 21)], [event("e", "Toast", 20, 20)]);
    expect(merged[0]!.kind).toBe("set");
    expect(merged[1]!.kind).toBe("event");
  });

  it("drops events with unparseable timestamps without affecting the sets", () => {
    const bad: TimelineEvent = { id: "x", title: "Broken", stageName: null, startsAtUtc: "nope", endsAtUtc: "nope" };
    const merged = mergeSquadTimeline(blocks, [bad]);
    expect(merged).toHaveLength(blocks.length);
    expect(merged.every((i) => i.kind === "set")).toBe(true);
  });

  it("handles no events (pure set list) and no blocks (pure agenda)", () => {
    expect(mergeSquadTimeline(blocks, [])).toHaveLength(3);
    expect(mergeSquadTimeline([], events).every((i) => i.kind === "event")).toBe(true);
  });
});

describe("eventClashLabel", () => {
  const blocks = [block("s1", "Tale of Us", 20, 21)];

  it("labels the set an event overlaps", () => {
    expect(eventClashLabel(event("e", "Dinner", 20, 21), blocks)).toBe("Tale of Us");
  });

  it("returns null when the event sits in a gap", () => {
    expect(eventClashLabel(event("e", "Dinner", 22, 23), blocks)).toBeNull();
  });
});

describe("eventsForDay (F02/DEC-110)", () => {
  // Day window: 18:00 UTC July 18 → 06:00 UTC July 19 (a typical festival night).
  const dayStart = Date.UTC(2026, 6, 18, 18, 0);
  const dayEnd = Date.UTC(2026, 6, 19, 6, 0);

  const inDay = event("e1", "Photo", 19, 19); // 19:00 July 18 — inside
  const afterDay = event("e2", "Brunch", 8, 9); // 08:00 July 18 — before window
  const nextDay: TimelineEvent = {
    id: "e3", title: "Morning yoga", stageName: null,
    startsAtUtc: new Date(Date.UTC(2026, 6, 19, 10, 0)).toISOString(),
    endsAtUtc: new Date(Date.UTC(2026, 6, 19, 11, 0)).toISOString(),
  };
  const badTs: TimelineEvent = { id: "e4", title: "Invalid", stageName: null, startsAtUtc: "bad", endsAtUtc: "bad" };

  it("keeps only events whose startsAtUtc falls within [dayStart, dayEnd)", () => {
    const result = eventsForDay([inDay, afterDay, nextDay, badTs], dayStart, dayEnd);
    expect(result.map((e) => e.id)).toEqual(["e1"]);
  });

  it("returns all events when window is 0 to Infinity", () => {
    const result = eventsForDay([inDay, afterDay, nextDay], 0, Infinity);
    expect(result).toHaveLength(3);
  });

  it("returns empty for an empty list", () => {
    expect(eventsForDay([], dayStart, dayEnd)).toEqual([]);
  });
});
