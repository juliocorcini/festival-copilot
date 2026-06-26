// @vitest-environment node
import { describe, expect, it } from "vitest";

import { durationLabel, eventBadge, eventCountdown, eventLifecycleFromIso, EVENT_SOON_MS } from "./eventsUi";

const START = Date.parse("2026-07-18T16:00:00Z");
const END = START + 30 * 60_000;
const startIso = new Date(START).toISOString();
const endIso = new Date(END).toISOString();

describe("eventsUi — lifecycle (client re-derive)", () => {
  it("is 'upcoming' beyond the soon window", () => {
    expect(eventLifecycleFromIso(startIso, endIso, START - EVENT_SOON_MS - 60_000)).toBe("upcoming");
  });
  it("is 'soon' inside the soon window (inclusive edge)", () => {
    expect(eventLifecycleFromIso(startIso, endIso, START - EVENT_SOON_MS)).toBe("soon");
    expect(eventLifecycleFromIso(startIso, endIso, START - 60_000)).toBe("soon");
  });
  it("is 'live' between start (inclusive) and end (exclusive)", () => {
    expect(eventLifecycleFromIso(startIso, endIso, START)).toBe("live");
    expect(eventLifecycleFromIso(startIso, endIso, END - 1)).toBe("live");
  });
  it("is 'past' at/after the end", () => {
    expect(eventLifecycleFromIso(startIso, endIso, END)).toBe("past");
  });
  it("falls back to 'upcoming' on an unparseable window", () => {
    expect(eventLifecycleFromIso("nope", endIso, START)).toBe("upcoming");
  });
});

describe("eventsUi — duration label", () => {
  it("formats minutes, hours, and mixed", () => {
    expect(durationLabel(0)).toBe("1m"); // never "0m"
    expect(durationLabel(25)).toBe("25m");
    expect(durationLabel(60)).toBe("1h");
    expect(durationLabel(130)).toBe("2h 10m");
  });
});

describe("eventsUi — countdown copy", () => {
  it("reads 'in …' before the start", () => {
    expect(eventCountdown(startIso, endIso, START - 25 * 60_000)).toBe("in 25m");
    expect(eventCountdown(startIso, endIso, START - 130 * 60_000)).toBe("in 2h 10m");
  });
  it("reads 'live now' during, 'ended' after", () => {
    expect(eventCountdown(startIso, endIso, START + 5 * 60_000)).toBe("live now");
    expect(eventCountdown(startIso, endIso, END + 60_000)).toBe("ended");
  });
});

describe("eventsUi — badge", () => {
  it("maps each lifecycle to a label + reuse-able pill tone", () => {
    expect(eventBadge("live")).toEqual({ label: "Live now", tone: "go" });
    expect(eventBadge("soon")).toEqual({ label: "Coming up", tone: "warn" });
    expect(eventBadge("upcoming")).toEqual({ label: "Upcoming", tone: "active" });
    expect(eventBadge("past")).toEqual({ label: "Ended", tone: "dead" });
  });
});
