// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPosterLayout, countClashes, POSTER_SIZES, type PosterInput } from "./planPoster";
import type { PlanSlot } from "../domain/types";

const MIN = 60_000;
function slot(label: string, startMin: number, stage = "MAINSTAGE", durationMin = 60): PlanSlot {
  return {
    setId: label,
    actKey: label,
    label,
    stageId: stage,
    stageName: stage,
    startMs: startMin * MIN,
    endMs: (startMin + durationMin) * MIN,
    cutMs: null,
  };
}

function input(slots: PlanSlot[], over: Partial<PosterInput> = {}): PosterInput {
  return { festivalName: "Tomorrowland", dayName: "Saturday", slots, timeZone: "UTC", format: "story", ...over };
}

describe("POSTER_SIZES", () => {
  it("uses 9:16 for stories and 1:1 for square", () => {
    expect(POSTER_SIZES.story).toEqual({ w: 1080, h: 1920 });
    expect(POSTER_SIZES.square).toEqual({ w: 1080, h: 1080 });
  });
});

describe("countClashes", () => {
  it("is zero for a clean, non-overlapping plan", () => {
    const slots = [slot("A", 0), slot("B", 60), slot("C", 120)];
    expect(countClashes(slots)).toBe(0);
  });

  it("counts each overlapping neighbour pair", () => {
    // A 00:00–01:30 overlaps B 01:00–02:00; C 03:00 is clean.
    const slots = [slot("A", 0, "S", 90), slot("B", 60), slot("C", 180)];
    expect(countClashes(slots)).toBe(1);
  });

  it("respects a tight-walk cut shortening a set (no clash once trimmed)", () => {
    const a = { ...slot("A", 0, "S", 90), cutMs: 60 * MIN }; // cut to end exactly at B's start
    const b = slot("B", 60);
    expect(countClashes([a, b])).toBe(0);
  });
});

describe("buildPosterLayout", () => {
  it("fits every set on a single page when they comfortably fit (no '+N' hiding)", () => {
    const slots = Array.from({ length: 6 }, (_, i) => slot(`Set ${i}`, i * 60));
    const layout = buildPosterLayout(input(slots));
    expect(layout.pages).toHaveLength(1);
    expect(layout.shown).toBe(6);
    expect(layout.total).toBe(6);
    expect(layout.pages[0]!.map((r) => r.label)).toEqual(["Set 0", "Set 1", "Set 2", "Set 3", "Set 4", "Set 5"]);
  });

  it("orders rows chronologically and exposes the fallback initials + concrete color", () => {
    const layout = buildPosterLayout(input([slot("Adriatique", 120), slot("Charlotte de Witte", 60, "CORE")]));
    const [first, second] = layout.pages[0]!;
    expect(first!.label).toBe("Charlotte de Witte");
    expect(first!.initials).toBe("CW");
    expect(first!.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(second!.label).toBe("Adriatique");
  });

  it("paginates instead of dropping sets when the plan is huge — every set still shown", () => {
    const slots = Array.from({ length: 30 }, (_, i) => slot(`Set ${i}`, i * 30, "MAINSTAGE", 25));
    const layout = buildPosterLayout(input(slots, { format: "story" }));
    expect(layout.pages.length).toBeGreaterThan(1);
    expect(layout.shown).toBe(30); // nothing hidden
    const flat = layout.pages.flat().map((r) => r.label);
    expect(flat).toHaveLength(30);
    expect(new Set(flat).size).toBe(30);
  });

  it("square summary mode caps to a single highlight page; full mode shows everything", () => {
    const slots = Array.from({ length: 20 }, (_, i) => slot(`Set ${i}`, i * 30, "MAINSTAGE", 25));
    const summary = buildPosterLayout(input(slots, { format: "square", mode: "summary" }));
    expect(summary.pages).toHaveLength(1);
    expect(summary.shown).toBeLessThan(summary.total);

    const full = buildPosterLayout(input(slots, { format: "square", mode: "full" }));
    expect(full.shown).toBe(20);
    expect(full.pages.length).toBeGreaterThan(1);
  });

  it("reports the real clash count on the layout", () => {
    const slots = [slot("A", 0, "S", 90), slot("B", 60), slot("C", 180)];
    expect(buildPosterLayout(input(slots)).clashes).toBe(1);
  });
});
