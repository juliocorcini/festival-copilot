import { describe, expect, it } from "vitest";

import {
  EVENT_SOON_MS,
  MAX_EVENT_DURATION_MS,
  MIN_EVENT_DURATION_MS,
  eventLifecycle,
  isLiveEvent,
  normalizeEventWindow,
} from "../src/domain/groupEvent";

describe("group-event domain — window normalization (pure)", () => {
  const start = Date.parse("2026-07-18T16:00:00Z");

  it("keeps a sane window untouched", () => {
    const end = start + 30 * 60_000;
    expect(normalizeEventWindow(start, end)).toEqual({ startsMs: start, endsMs: end });
  });

  it("floors a zero / negative / too-short window to the minimum duration", () => {
    expect(normalizeEventWindow(start, start)).toEqual({ startsMs: start, endsMs: start + MIN_EVENT_DURATION_MS });
    expect(normalizeEventWindow(start, start - 10_000)).toEqual({
      startsMs: start,
      endsMs: start + MIN_EVENT_DURATION_MS,
    });
    expect(normalizeEventWindow(start, start + 60_000)).toEqual({
      startsMs: start,
      endsMs: start + MIN_EVENT_DURATION_MS,
    });
  });

  it("treats a non-finite end as missing → minimum duration", () => {
    expect(normalizeEventWindow(start, Number.NaN)).toEqual({ startsMs: start, endsMs: start + MIN_EVENT_DURATION_MS });
  });

  it("caps an absurdly long window at the maximum duration", () => {
    const end = start + 3 * 24 * 60 * 60_000; // 3 days
    expect(normalizeEventWindow(start, end)).toEqual({ startsMs: start, endsMs: start + MAX_EVENT_DURATION_MS });
  });
});

describe("group-event domain — lifecycle (pure, derived)", () => {
  const start = Date.parse("2026-07-18T16:00:00Z");
  const end = start + 30 * 60_000;

  it("is 'upcoming' when the start is beyond the soon window", () => {
    const now = start - EVENT_SOON_MS - 60_000;
    expect(eventLifecycle(start, end, now)).toBe("upcoming");
  });

  it("is 'soon' inside the soon window before the start (inclusive edge)", () => {
    expect(eventLifecycle(start, end, start - EVENT_SOON_MS)).toBe("soon");
    expect(eventLifecycle(start, end, start - 60_000)).toBe("soon");
  });

  it("is 'live' once the start passes and before the end (start edge inclusive)", () => {
    expect(eventLifecycle(start, end, start)).toBe("live");
    expect(eventLifecycle(start, end, start + 15 * 60_000)).toBe("live");
    expect(eventLifecycle(start, end, end - 1)).toBe("live");
  });

  it("is 'past' once now reaches the end (end edge → past)", () => {
    expect(eventLifecycle(start, end, end)).toBe("past");
    expect(eventLifecycle(start, end, end + 60_000)).toBe("past");
  });

  it("isLiveEvent: true for upcoming/soon/live, false for past", () => {
    expect(isLiveEvent("upcoming")).toBe(true);
    expect(isLiveEvent("soon")).toBe(true);
    expect(isLiveEvent("live")).toBe(true);
    expect(isLiveEvent("past")).toBe(false);
  });
});
