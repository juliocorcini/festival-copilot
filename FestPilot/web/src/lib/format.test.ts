// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { dayLabel, daysUntil, stageColor, stageColorHex, stageColorRgb, timeInZone } from "./format";

const PALETTE = [
  "var(--s-main)",
  "var(--s-free)",
  "var(--s-core)",
  "var(--s-cage)",
  "var(--s-elix)",
  "var(--s-rose)",
];

describe("stageColor", () => {
  it("falls back to muted for empty input", () => {
    expect(stageColor(null)).toBe("var(--muted)");
    expect(stageColor(undefined)).toBe("var(--muted)");
    expect(stageColor("")).toBe("var(--muted)");
  });

  it("maps known stages by case-insensitive substring", () => {
    expect(stageColor("MAINSTAGE")).toBe("var(--s-main)");
    expect(stageColor("mainstage")).toBe("var(--s-main)"); // case-insensitive
    expect(stageColor("CORE")).toBe("var(--s-core)");
    expect(stageColor("CAGE")).toBe("var(--s-cage)");
    expect(stageColor("ELIXIR")).toBe("var(--s-elix)");
    expect(stageColor("FREEDOM BY BUD")).toBe("var(--s-free)");
    expect(stageColor("THE ROSE GARDEN")).toBe("var(--s-rose)");
  });

  it("hashes unknown stages deterministically into the palette", () => {
    const a = stageColor("ATMOSPHERE");
    expect(stageColor("ATMOSPHERE")).toBe(a); // stable across calls
    expect(PALETTE).toContain(a);
  });
});

describe("stageColorHex / stageColorRgb", () => {
  it("resolves the brand token to a concrete hex", () => {
    expect(stageColorHex("MAINSTAGE")).toBe("#ff5a36");
    expect(stageColorHex("CORE")).toBe("#16a34a");
    expect(stageColorHex(null)).toBe("#9c9080"); // muted
  });

  it("expresses the hex as an 'r, g, b' triple", () => {
    expect(stageColorRgb("MAINSTAGE")).toBe("255, 90, 54"); // #ff5a36
    expect(stageColorRgb("CORE")).toBe("22, 163, 74"); // #16a34a
  });
});

describe("timeInZone", () => {
  it("returns a placeholder for empty or invalid input", () => {
    expect(timeInZone(null, "Europe/Brussels")).toBe("--:--");
    expect(timeInZone("not-a-date", "Europe/Brussels")).toBe("--:--");
  });

  it("formats HH:mm honoring the festival timezone offset", () => {
    const instant = "2026-07-17T20:30:00Z"; // July → CEST (UTC+2) in Belgium
    expect(timeInZone(instant, "UTC")).toBe("20:30");
    expect(timeInZone(instant, "Europe/Brussels")).toBe("22:30");
    expect(timeInZone(instant, "America/Sao_Paulo")).toBe("17:30"); // UTC-3, no DST
  });

  it("uses a 24-hour clock (no AM/PM)", () => {
    expect(timeInZone("2026-07-17T23:15:00Z", "UTC")).toBe("23:15");
  });
});

describe("dayLabel", () => {
  it("returns an empty string for empty or invalid input", () => {
    expect(dayLabel(null, "UTC")).toBe("");
    expect(dayLabel("nope", "UTC")).toBe("");
  });

  it("formats an upper-cased weekday/day/month label in the timezone", () => {
    const label = dayLabel("2026-07-18T10:00:00Z", "Europe/Brussels"); // a Saturday
    expect(label).toBe(label.toUpperCase()); // always upper-cased
    expect(label).toContain("SAT");
    expect(label).toContain("18");
    expect(label).toContain("JUL");
  });

  it("rolls the calendar day across the timezone boundary", () => {
    const instant = "2026-07-17T23:30:00Z"; // 01:30 the next day in Brussels (UTC+2)
    const utc = dayLabel(instant, "UTC");
    const brussels = dayLabel(instant, "Europe/Brussels");
    expect(utc).toContain("FRI");
    expect(utc).toContain("17");
    expect(brussels).toContain("SAT");
    expect(brussels).toContain("18");
  });
});

describe("daysUntil", () => {
  afterEach(() => vi.useRealTimers());

  it("is 0 for empty, invalid, or past instants", () => {
    expect(daysUntil(null)).toBe(0);
    expect(daysUntil("garbage")).toBe(0);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T00:00:00Z"));
    expect(daysUntil("2026-01-01T00:00:00Z")).toBe(0); // already past
  });

  it("ceils the whole-day countdown to a future instant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    expect(daysUntil("2026-01-04T00:00:00Z")).toBe(3); // exactly 3 days out
    expect(daysUntil("2026-01-01T12:00:00Z")).toBe(1); // half a day → ceil = 1
    expect(daysUntil("2026-01-01T00:00:00Z")).toBe(0); // this instant → 0
  });
});
