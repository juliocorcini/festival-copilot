// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPosterRows, POSTER_SIZES } from "./planPoster";
import type { PlanSlot } from "../domain/types";

const MIN = 60_000;
function slot(label: string, startMin: number, stage = "MAINSTAGE"): PlanSlot {
  return {
    setId: label,
    actKey: label,
    label,
    stageId: stage,
    stageName: stage,
    startMs: startMin * MIN,
    endMs: (startMin + 60) * MIN,
    cutMs: null,
  };
}

describe("POSTER_SIZES", () => {
  it("uses 9:16 for stories and 1:1 for square", () => {
    expect(POSTER_SIZES.story).toEqual({ w: 1080, h: 1920 });
    expect(POSTER_SIZES.square).toEqual({ w: 1080, h: 1080 });
  });
});

describe("buildPosterRows", () => {
  const tz = "UTC";

  it("orders rows chronologically and formats each row", () => {
    const slots = [slot("Adriatique", 120), slot("Charlotte de Witte", 60, "CORE")];
    const { rows, overflow } = buildPosterRows(slots, tz, 10);
    expect(overflow).toBe(0);
    expect(rows.map((r) => r.label)).toEqual(["Charlotte de Witte", "Adriatique"]);
    expect(rows[0]).toMatchObject({ label: "Charlotte de Witte", stageName: "CORE" });
    expect(rows[0]!.time).toMatch(/01[:.]00|1:00/); // 60 min after epoch = 01:00 UTC
    expect(rows[0]!.color).toMatch(/^#[0-9a-f]{6}$/i); // concrete hex (canvas can't resolve CSS vars)
  });

  it("caps to max and reports the overflow, keeping room for the '+N' line", () => {
    const slots = Array.from({ length: 12 }, (_, i) => slot(`Set ${i}`, i * 60));
    const { rows, overflow } = buildPosterRows(slots, tz, 8);
    expect(rows).toHaveLength(7); // max - 1, so the "+N more" line fits
    expect(overflow).toBe(5);
    expect(rows[0]!.label).toBe("Set 0"); // earliest kept
  });

  it("shows all rows with no overflow when they fit exactly", () => {
    const slots = Array.from({ length: 8 }, (_, i) => slot(`Set ${i}`, i * 60));
    const { rows, overflow } = buildPosterRows(slots, tz, 8);
    expect(rows).toHaveLength(8);
    expect(overflow).toBe(0);
  });

  it("never drops below one row even with a tiny cap", () => {
    const slots = [slot("A", 0), slot("B", 60), slot("C", 120)];
    const { rows, overflow } = buildPosterRows(slots, tz, 1);
    expect(rows).toHaveLength(1);
    expect(overflow).toBe(2);
  });
});
