import { describe, expect, it } from "vitest";

import { clampGraceMinutes, DEFAULT_GRACE_MIN, landmarkLabel, meetingExpiry } from "../src/domain/meeting";
import type { CoarsePresence } from "../src/domain/presence";

const names = new Map([
  ["s1", "FREEDOM"],
  ["s2", "CORE"],
]);

function coarse(partial: Partial<CoarsePresence>): CoarsePresence {
  return { stageId: null, betweenStageId: null, coarseLabel: "none", confidence: "low", meters: null, ...partial };
}

describe("meeting domain — landmark label (pure)", () => {
  it("'at STAGE' when inside a stage", () => {
    expect(landmarkLabel(coarse({ stageId: "s1", coarseLabel: "at" }), names)).toBe("at FREEDOM");
  });

  it("'near STAGE' when clearly closest to one", () => {
    expect(landmarkLabel(coarse({ stageId: "s2", coarseLabel: "near" }), names)).toBe("near CORE");
  });

  it("'between A & B' when genuinely between two named stages", () => {
    expect(landmarkLabel(coarse({ stageId: "s1", betweenStageId: "s2", coarseLabel: "between" }), names)).toBe(
      "between FREEDOM & CORE"
    );
  });

  it("falls back to 'near A' for a between reading missing its second name", () => {
    expect(landmarkLabel(coarse({ stageId: "s1", betweenStageId: "ghost", coarseLabel: "between" }), names)).toBe(
      "near FREEDOM"
    );
  });

  it("'in the venue' when there is no nearby named stage", () => {
    expect(landmarkLabel(coarse({ coarseLabel: "none" }), names)).toBe("in the venue");
    expect(landmarkLabel(coarse({ stageId: "unknown", coarseLabel: "at" }), names)).toBe("in the venue");
  });
});

describe("meeting domain — grace clamp + expiry (pure)", () => {
  it("defaults a missing/invalid grace to 30 min", () => {
    expect(clampGraceMinutes(undefined)).toBe(DEFAULT_GRACE_MIN);
    expect(clampGraceMinutes(null)).toBe(DEFAULT_GRACE_MIN);
    expect(clampGraceMinutes(Number.NaN)).toBe(DEFAULT_GRACE_MIN);
  });

  it("clamps grace into the [10, 240] range", () => {
    expect(clampGraceMinutes(5)).toBe(10);
    expect(clampGraceMinutes(45)).toBe(45);
    expect(clampGraceMinutes(99999)).toBe(240);
  });

  it("expires a meet-now point grace-minutes after now", () => {
    const now = Date.parse("2026-07-18T20:00:00Z");
    expect(meetingExpiry(null, now, 30)).toBe(now + 30 * 60_000);
    // A past meet time also bases off now (never in the past).
    expect(meetingExpiry(now - 60_000, now, 30)).toBe(now + 30 * 60_000);
  });

  it("expires a future point grace-minutes after the MEET time", () => {
    const now = Date.parse("2026-07-18T20:00:00Z");
    const meet = now + 30 * 60_000;
    expect(meetingExpiry(meet, now, 30)).toBe(meet + 30 * 60_000);
  });
});
