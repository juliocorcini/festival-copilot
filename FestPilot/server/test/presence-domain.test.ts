import { describe, expect, it } from "vitest";
import {
  AT_RADIUS_M,
  coarsenPresence,
  EXPIRY_MINUTES,
  metersBetween,
  precisePinOf,
  presenceExpiry,
  type PreciseInput,
  type StageCoord,
} from "../src/domain/presence";

// A small festival at ~51°N: MAIN and CORE sit ~400 m apart east-west; FREE is far (~1.5 km north).
// (At lat 51, cos≈0.629, so 1° lng ≈ 70 030 m and 1° lat ≈ 111 320 m.)
const MAIN: StageCoord = { stageId: "main", lat: 51.0, lng: 4.0 };
const CORE: StageCoord = { stageId: "core", lat: 51.0, lng: 4.00571 }; // ~400 m east of MAIN
const FREE: StageCoord = { stageId: "free", lat: 51.0135, lng: 4.0 }; // ~1.5 km north of MAIN
const STAGES = [MAIN, CORE, FREE];

/** Move a point north by `m` metres (lat only) — handy for building exact distances. */
function north(from: StageCoord, m: number): { lat: number; lng: number } {
  return { lat: from.lat + m / 111320, lng: from.lng };
}

describe("metersBetween", () => {
  it("is ~0 at the same point and matches the known MAIN↔CORE spacing", () => {
    expect(metersBetween(MAIN, MAIN)).toBeLessThan(1);
    expect(metersBetween(MAIN, CORE)).toBeGreaterThan(390);
    expect(metersBetween(MAIN, CORE)).toBeLessThan(410);
  });
});

describe("coarsenPresence (UC-22 — at / near / between / none)", () => {
  it('reads "at STAGE" with high confidence inside the at-radius', () => {
    const r = coarsenPresence(north(MAIN, AT_RADIUS_M - 20), STAGES, 8);
    expect(r.coarseLabel).toBe("at");
    expect(r.stageId).toBe("main");
    expect(r.confidence).toBe("high");
    expect(r.betweenStageId).toBeNull();
  });

  it('caps an "at" reading to medium confidence when the GPS fix is poor', () => {
    const r = coarsenPresence({ lat: MAIN.lat, lng: MAIN.lng }, STAGES, 120);
    expect(r.coarseLabel).toBe("at");
    expect(r.confidence).toBe("medium");
  });

  it('reads "near STAGE" (medium) when clearly closest to one stage but outside the at-radius', () => {
    const r = coarsenPresence(north(MAIN, 150), STAGES);
    expect(r.coarseLabel).toBe("near");
    expect(r.stageId).toBe("main");
    expect(r.confidence).toBe("medium");
  });

  it('reads "between A and B" (low) at the midpoint of two comparable stages', () => {
    const midLng = (MAIN.lng + CORE.lng) / 2; // ~200 m from each
    const r = coarsenPresence({ lat: 51.0, lng: midLng }, STAGES);
    expect(r.coarseLabel).toBe("between");
    expect([r.stageId, r.betweenStageId].sort()).toEqual(["core", "main"]);
    expect(r.confidence).toBe("low");
  });

  it('reads "none" when every stage is far away', () => {
    const r = coarsenPresence(north(MAIN, 5000), STAGES);
    expect(r.coarseLabel).toBe("none");
    expect(r.stageId).toBeNull();
  });

  it('reads "none" when there are no georeferenced stages', () => {
    const r = coarsenPresence({ lat: 51.0, lng: 4.0 }, []);
    expect(r.coarseLabel).toBe("none");
    expect(r.confidence).toBe("low");
  });
});

describe("presenceExpiry (DEC-008 freshness windows)", () => {
  it("trusts a GPS fix ~15 min and a manual/push reply ~45 min", () => {
    const now = Date.parse("2026-07-18T20:00:00Z");
    expect(EXPIRY_MINUTES.gps).toBe(15);
    expect(EXPIRY_MINUTES.manual).toBe(45);
    expect(presenceExpiry("gps", now) - now).toBe(15 * 60_000);
    expect(presenceExpiry("push_reply", now) - now).toBe(45 * 60_000);
  });
});

describe("precisePinOf (DEC-099 — the exact-pin privacy/safety gate)", () => {
  const NOW = Date.parse("2026-07-18T20:30:00Z");
  // A precise+live member with a still-fresh fix: the happy path that exposes a pin.
  const live: PreciseInput = {
    userId: "u1",
    shareLocation: "live_until",
    shareUntil: "2026-07-18T21:00:00Z", // window open
    lat: 51.0,
    lng: 4.00571,
    accuracyMeters: 12,
    updatedAt: "2026-07-18T20:29:00Z", // 60s ago
    fixExpiresAt: "2026-07-18T20:44:00Z", // fix still fresh
  };

  it("exposes the exact pin with TTL + age when precise, live and freshly fixed", () => {
    const pin = precisePinOf(live, NOW);
    expect(pin).not.toBeNull();
    expect(pin!.userId).toBe("u1");
    expect(pin!.lat).toBe(51.0);
    expect(pin!.lng).toBe(4.00571);
    expect(pin!.accuracyMeters).toBe(12);
    expect(pin!.expiresAtUtc).toBe("2026-07-18T21:00:00Z");
    expect(pin!.ageSeconds).toBe(60);
  });

  it("returns null when the member is not precise (coarse 'stage' never leaks a coordinate)", () => {
    expect(precisePinOf({ ...live, shareLocation: "while_using" }, NOW)).toBeNull();
    expect(precisePinOf({ ...live, shareLocation: "off" }, NOW)).toBeNull();
  });

  it("returns null when the precise window has lapsed (TTL is hard)", () => {
    expect(precisePinOf({ ...live, shareUntil: "2026-07-18T20:29:00Z" }, NOW)).toBeNull();
    expect(precisePinOf({ ...live, shareUntil: null }, NOW)).toBeNull();
  });

  it("returns null when the fix is stale — never a misleading old 'exact' dot", () => {
    expect(precisePinOf({ ...live, fixExpiresAt: "2026-07-18T20:20:00Z" }, NOW)).toBeNull();
    expect(precisePinOf({ ...live, fixExpiresAt: null }, NOW)).toBeNull();
  });

  it("returns null when coordinates or the fix timestamp are missing", () => {
    expect(precisePinOf({ ...live, lat: null }, NOW)).toBeNull();
    expect(precisePinOf({ ...live, lng: null }, NOW)).toBeNull();
    expect(precisePinOf({ ...live, updatedAt: null }, NOW)).toBeNull();
  });
});
