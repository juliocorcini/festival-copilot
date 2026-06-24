import { describe, expect, it } from "vitest";

import {
  clampGraceMinutes,
  creatorDrifted,
  DEFAULT_GRACE_MIN,
  DRIFT_RADIUS_M,
  EXPIRING_SOON_MS,
  isLiveLifecycle,
  landmarkLabel,
  meetingExpiry,
  meetingLifecycle,
  walkEtaMinutes,
} from "../src/domain/meeting";
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

describe("meeting domain — lifecycle (pure, derived)", () => {
  const now = Date.parse("2026-07-18T22:00:00Z");
  const farExpiry = now + 60 * 60_000; // an hour out
  const base = { dbStatus: "active", expiresAtMs: farExpiry, nowMs: now };

  it("a freshly dropped point (only the creator going) is 'active'", () => {
    expect(meetingLifecycle({ ...base, onTheWayCount: 1, hereCount: 0 })).toBe("active");
  });

  it("is 'on_the_way' once a second person is heading over, or anyone is already here", () => {
    expect(meetingLifecycle({ ...base, onTheWayCount: 2, hereCount: 0 })).toBe("on_the_way");
    expect(meetingLifecycle({ ...base, onTheWayCount: 2, hereCount: 1 })).toBe("on_the_way");
    expect(meetingLifecycle({ ...base, onTheWayCount: 0, hereCount: 1 })).toBe("on_the_way");
  });

  it("is 'everyone_here' only when ≥2 are committed and ALL of them arrived", () => {
    expect(meetingLifecycle({ ...base, onTheWayCount: 0, hereCount: 3 })).toBe("everyone_here");
    // a lone creator who's "here" is NOT a reunion
    expect(meetingLifecycle({ ...base, onTheWayCount: 0, hereCount: 1 })).toBe("on_the_way");
    // still someone on the way → not everyone here
    expect(meetingLifecycle({ ...base, onTheWayCount: 1, hereCount: 2 })).toBe("on_the_way");
  });

  it("'everyone_here' wins over 'expiring_soon' (the reunion beats the clock)", () => {
    const soon = now + EXPIRING_SOON_MS - 1;
    expect(meetingLifecycle({ dbStatus: "active", expiresAtMs: soon, nowMs: now, onTheWayCount: 0, hereCount: 2 })).toBe(
      "everyone_here"
    );
  });

  it("flags 'expiring_soon' inside the final window", () => {
    const soon = now + EXPIRING_SOON_MS - 1;
    expect(meetingLifecycle({ dbStatus: "active", expiresAtMs: soon, nowMs: now, onTheWayCount: 1, hereCount: 0 })).toBe(
      "expiring_soon"
    );
  });

  it("is 'expired' once now passes expiry, or the row was archived", () => {
    expect(meetingLifecycle({ dbStatus: "active", expiresAtMs: now - 1, nowMs: now, onTheWayCount: 1, hereCount: 0 })).toBe(
      "expired"
    );
    expect(meetingLifecycle({ ...base, dbStatus: "archived", onTheWayCount: 2, hereCount: 2 })).toBe("expired");
  });

  it("'cancelled' is terminal — it beats everything, even a full reunion", () => {
    expect(meetingLifecycle({ ...base, dbStatus: "cancelled", onTheWayCount: 0, hereCount: 5 })).toBe("cancelled");
  });

  it("isLiveLifecycle: live for active/on_the_way/everyone_here/expiring_soon, dead for expired/cancelled", () => {
    expect(isLiveLifecycle("active")).toBe(true);
    expect(isLiveLifecycle("everyone_here")).toBe(true);
    expect(isLiveLifecycle("expiring_soon")).toBe(true);
    expect(isLiveLifecycle("expired")).toBe(false);
    expect(isLiveLifecycle("cancelled")).toBe(false);
  });
});

describe("meeting domain — walk ETA + drift (pure)", () => {
  it("floors the ETA at 1 minute (never '0 min away')", () => {
    expect(walkEtaMinutes(0)).toBe(1);
    expect(walkEtaMinutes(20)).toBe(1);
  });

  it("scales with distance using the ×1.3 detour over ~67 m/min", () => {
    // 670 m straight → ×1.3 = 871 m → /67 ≈ 13 min
    expect(walkEtaMinutes(670)).toBe(13);
    // 220 m (the wireframe's "~3 min · 220m") → ×1.3 = 286 → /67 ≈ 4 min
    expect(walkEtaMinutes(220)).toBe(4);
  });

  it("creatorDrifted: unknown distance is never a prompt; only beyond the drift radius is", () => {
    expect(creatorDrifted(null)).toBe(false);
    expect(creatorDrifted(DRIFT_RADIUS_M)).toBe(false);
    expect(creatorDrifted(DRIFT_RADIUS_M + 1)).toBe(true);
  });
});
