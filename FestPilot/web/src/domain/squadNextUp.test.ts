import { describe, expect, it } from "vitest";
import { squadNextUp, type SquadNextUpInput } from "./squadNextUp";

const NOW = Date.UTC(2026, 6, 18, 20, 0, 0); // 20:00
const iso = (h: number, m = 0): string => new Date(Date.UTC(2026, 6, 18, h, m)).toISOString();
const at = (h: number, m = 0): number => Date.UTC(2026, 6, 18, h, m);

function set(label: string, startH: number, endH: number, stageName = "MAINSTAGE"): SquadNextUpInput["sets"][number] {
  return { label, stageName, startMs: at(startH), endMs: at(endH) };
}
function event(title: string, startH: number, endH: number, stageName: string | null = null): SquadNextUpInput["events"][number] {
  return { title, stageName, startsAtUtc: iso(startH), endsAtUtc: iso(endH) };
}

describe("squadNextUp (D20/D24)", () => {
  it("returns null when nothing is scheduled or active", () => {
    expect(squadNextUp({ sets: [], events: [], meet: null, now: NOW })).toBeNull();
  });

  it("surfaces a live set (start ≤ now < end) and marks it live", () => {
    const focus = squadNextUp({ sets: [set("Charlotte de Witte", 19, 21)], events: [], meet: null, now: NOW });
    expect(focus).toMatchObject({ kind: "set", title: "Charlotte de Witte", where: "MAINSTAGE", live: true });
  });

  it("prefers the live item ending soonest over a later live one", () => {
    const focus = squadNextUp({
      sets: [set("Long", 18, 23), set("EndingSoon", 19, 21, "CORE")],
      events: [],
      meet: null,
      now: NOW,
    });
    // both are live at 20:00; "EndingSoon" ends at 21:00 (sooner than 23:00) → it wins.
    expect(focus?.title).toBe("EndingSoon");
  });

  it("falls back to the soonest upcoming item when nothing is live", () => {
    const focus = squadNextUp({
      sets: [set("Later", 23, 24)],
      events: [event("Meet at the flag", 21, 21)],
      meet: null,
      now: NOW,
    });
    expect(focus).toMatchObject({ kind: "event", title: "Meet at the flag", live: false, startMs: at(21) });
  });

  it("drops past items (ended before now)", () => {
    const focus = squadNextUp({
      sets: [set("Done", 17, 19), set("Next", 21, 22)],
      events: [],
      meet: null,
      now: NOW,
    });
    expect(focus?.title).toBe("Next");
  });

  it("breaks an upcoming tie by event-before-set", () => {
    const focus = squadNextUp({
      sets: [set("ASet", 21, 22)],
      events: [event("AnEvent", 21, 22)],
      meet: null,
      now: NOW,
    });
    expect(focus?.kind).toBe("event");
  });

  it("uses the active meeting point only when nothing is scheduled ahead", () => {
    const focus = squadNextUp({
      sets: [set("Done", 17, 19)],
      events: [],
      meet: { title: "Flagpole", landmarkLabel: "between FREEDOM & CORE" },
      now: NOW,
    });
    expect(focus).toMatchObject({ kind: "meet", title: "Flagpole", where: "between FREEDOM & CORE", live: true, startMs: null });
  });

  it("a scheduled focus outranks the meeting point", () => {
    const focus = squadNextUp({
      sets: [set("Live", 19, 21)],
      events: [],
      meet: { title: "Flagpole", landmarkLabel: "at FREEDOM" },
      now: NOW,
    });
    expect(focus?.kind).toBe("set");
  });
});
