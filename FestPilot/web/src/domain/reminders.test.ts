import { describe, expect, it } from "vitest";
import {
  DEFAULT_REMINDER_SETTINGS,
  planReminders,
  withinQuietHours,
  type PlannedSet,
} from "./reminders";

const MIN = 60_000;
const NOW = 12 * 60 * MIN; // an arbitrary fixed "now" (12:00 in epoch-minutes terms)

function set(over: Partial<PlannedSet> & { setId: string; startMs: number }): PlannedSet {
  return { artistLabel: "Charlotte de Witte", stageName: "MAINSTAGE", walkMinutes: 0, ...over };
}

describe("planReminders — when reminders fire (E25/DEC-105)", () => {
  it("schedules a set-start at start − lead and a leave-by at start − (walk + buffer)", () => {
    const sets = [set({ setId: "s1", startMs: NOW + 30 * MIN, walkMinutes: 5 })];
    const out = planReminders(sets, DEFAULT_REMINDER_SETTINGS, NOW); // lead 10, buffer 2

    expect(out).toHaveLength(2);
    const start = out.find((r) => r.kind === "set-start")!;
    const leave = out.find((r) => r.kind === "leave-by")!;
    expect(start.fireAtMs).toBe(NOW + 20 * MIN); // 30 − 10
    expect(start.minutes).toBe(10);
    expect(leave.fireAtMs).toBe(NOW + 23 * MIN); // 30 − (5 + 2)
    expect(leave.minutes).toBe(5);
  });

  it("omits the leave-by when there is no real walk (same stage / first set)", () => {
    const out = planReminders([set({ setId: "s1", startMs: NOW + 40 * MIN, walkMinutes: 0 })], DEFAULT_REMINDER_SETTINGS, NOW);
    expect(out.map((r) => r.kind)).toEqual(["set-start"]);
  });

  it("drops reminders whose fire time already passed beyond the grace window", () => {
    // Starts in 5 min: the 10-min lead reminder would fire 5 min ago (stale) → dropped.
    const out = planReminders([set({ setId: "soon", startMs: NOW + 5 * MIN, walkMinutes: 0 })], DEFAULT_REMINDER_SETTINGS, NOW);
    expect(out).toHaveLength(0);
  });

  it("keeps a reminder that just came due within the grace window so it still fires once", () => {
    // set-start at start − 10; choose start so the fire time is 60s in the past (< 90s grace).
    const startMs = NOW + (10 * MIN - 60_000);
    const out = planReminders([set({ setId: "edge", startMs })], DEFAULT_REMINDER_SETTINGS, NOW);
    expect(out).toHaveLength(1);
    expect(out[0]!.fireAtMs).toBe(NOW - 60_000);
  });

  it("sorts earliest first, with leave-by before set-start on a tie", () => {
    const sets = [
      set({ setId: "late", startMs: NOW + 90 * MIN, walkMinutes: 12 }),
      set({ setId: "early", startMs: NOW + 30 * MIN, walkMinutes: 5 }),
    ];
    const out = planReminders(sets, DEFAULT_REMINDER_SETTINGS, NOW);
    const fires = out.map((r) => r.fireAtMs);
    const sorted = [...fires].sort((a, b) => a - b);
    expect(fires).toEqual(sorted);
  });

  it("gives every reminder a stable, unique id for dedupe + fired-tracking", () => {
    const sets = [set({ setId: "s1", startMs: NOW + 30 * MIN, walkMinutes: 5 })];
    const ids = planReminders(sets, DEFAULT_REMINDER_SETTINGS, NOW).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("s1:set-start");
    expect(ids).toContain("s1:leave-by");
  });
});

describe("withinQuietHours", () => {
  it("is always false when disabled", () => {
    expect(withinQuietHours(3, null)).toBe(false);
  });

  it("matches a same-day window [start, end)", () => {
    const q = { startHour: 9, endHour: 17 };
    expect(withinQuietHours(12, q)).toBe(true);
    expect(withinQuietHours(17, q)).toBe(false);
    expect(withinQuietHours(8, q)).toBe(false);
  });

  it("matches a window that wraps past midnight", () => {
    const q = { startHour: 23, endHour: 7 };
    expect(withinQuietHours(2, q)).toBe(true);
    expect(withinQuietHours(23, q)).toBe(true);
    expect(withinQuietHours(12, q)).toBe(false);
  });
});
