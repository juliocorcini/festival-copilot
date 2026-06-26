// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  bearingDegrees,
  buildTravelMatrix,
  compassPoint,
  coordToStage,
  metersBetween,
  travelPairKey,
  type LatLng,
} from "./travel";

describe("metersBetween", () => {
  it("measures east-west distance at the equator (k = 1)", () => {
    // 0.003° lng at the equator ≈ 333.96 m.
    expect(metersBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 0.003 })).toBeCloseTo(333.96, 0);
  });
});

describe("bearingDegrees (compass-arrow navigation, Gate 6.3)", () => {
  const origin: LatLng = { lat: 0, lng: 0 };
  it("points due east toward a point to the east (~90°)", () => {
    expect(bearingDegrees(origin, { lat: 0, lng: 0.01 })).toBeCloseTo(90, 1);
  });
  it("points due north toward a point to the north (~0°)", () => {
    expect(bearingDegrees(origin, { lat: 0.01, lng: 0 })).toBeCloseTo(0, 1);
  });
  it("points due west toward a point to the west (~270°)", () => {
    expect(bearingDegrees(origin, { lat: 0, lng: -0.01 })).toBeCloseTo(270, 1);
  });
  it("points roughly north-east toward a point up-and-right (~45°)", () => {
    expect(bearingDegrees(origin, { lat: 0.01, lng: 0.01 })).toBeGreaterThan(40);
    expect(bearingDegrees(origin, { lat: 0.01, lng: 0.01 })).toBeLessThan(50);
  });
  it("always returns a normalized 0–360 value", () => {
    const b = bearingDegrees(origin, { lat: -0.01, lng: -0.01 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("compassPoint", () => {
  it("maps cardinal + intercardinal bearings to 8-point labels", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(45)).toBe("NE");
    expect(compassPoint(90)).toBe("E");
    expect(compassPoint(180)).toBe("S");
    expect(compassPoint(270)).toBe("W");
    expect(compassPoint(315)).toBe("NW");
  });
  it("rounds to the nearest point and wraps past 360", () => {
    expect(compassPoint(20)).toBe("N"); // 20 → nearest 0
    expect(compassPoint(350)).toBe("N"); // wraps
    expect(compassPoint(360 + 90)).toBe("E");
  });
});

describe("buildTravelMatrix", () => {
  const coords = new Map<string, LatLng>([
    ["a", { lat: 0, lng: 0 }],
    ["b", { lat: 0, lng: 0.003 }], // 333.96 m east of a
    ["c", { lat: 0, lng: 0.0003 }], // 33.4 m east of a
  ]);
  const travel = buildTravelMatrix(coords, { metersPerMinute: 67, detour: 1.3, minMinutes: 2, fallbackMinutes: 8 });

  it("returns 0 for the same stage", () => {
    expect(travel.minutesBetween("a", "a")).toBe(0);
  });

  it("estimates minutes from distance × detour ÷ speed (symmetric)", () => {
    // 333.96 × 1.3 ÷ 67 = 6.48 → 6.
    expect(travel.minutesBetween("a", "b")).toBe(6);
    expect(travel.minutesBetween("b", "a")).toBe(6);
  });

  it("floors very close stages at minMinutes", () => {
    // 33.4 × 1.3 ÷ 67 = 0.65 → 1, floored to 2.
    expect(travel.minutesBetween("a", "c")).toBe(2);
  });

  it("falls back when either stage has no coordinates", () => {
    expect(travel.minutesBetween("a", "z")).toBe(8);
    expect(travel.minutesBetween(null, "a")).toBe(8);
  });
});

describe("buildTravelMatrix with operator overrides (DEC-065)", () => {
  const coords = new Map<string, LatLng>([
    ["a", { lat: 0, lng: 0 }],
    ["b", { lat: 0, lng: 0.003 }], // 333.96 m east → coord estimate = 6 min
  ]);
  const overrides = new Map<string, number>([[travelPairKey("a", "b"), 15]]);
  const travel = buildTravelMatrix(coords, {
    metersPerMinute: 67,
    detour: 1.3,
    minMinutes: 2,
    fallbackMinutes: 8,
    overrides,
  });

  it("prefers a stored pair over the coord estimate (the real path the admin measured)", () => {
    expect(travel.minutesBetween("a", "b")).toBe(15); // override wins over the 6-min estimate
  });

  it("is directional — the reverse pair is not overridden, so it uses the coord estimate", () => {
    expect(travel.minutesBetween("b", "a")).toBe(6);
  });

  it("an override still loses to the same-stage zero", () => {
    const selfOverride = new Map<string, number>([[travelPairKey("a", "a"), 9]]);
    const m = buildTravelMatrix(coords, { overrides: selfOverride });
    expect(m.minutesBetween("a", "a")).toBe(0);
  });

  it("an override can stand in for missing coords (pair with no geometry)", () => {
    const m = buildTravelMatrix(new Map(), {
      fallbackMinutes: 8,
      overrides: new Map([[travelPairKey("x", "y"), 12]]),
    });
    expect(m.minutesBetween("x", "y")).toBe(12);
    expect(m.minutesBetween("y", "x")).toBe(8); // no override + no coords → fallback
  });
});

describe("coordToStage", () => {
  const coords = new Map<string, LatLng>([
    ["s1", { lat: 0, lng: 0 }],
    ["s2", { lat: 0, lng: 0.01 }], // ~1113 m away
  ]);

  it("returns the nearest stage with distance-tiered confidence", () => {
    expect(coordToStage({ lat: 0, lng: 0.0005 }, coords)).toMatchObject({ stageId: "s1", confidence: "high" }); // 55 m
    expect(coordToStage({ lat: 0, lng: 0.0015 }, coords)).toMatchObject({ stageId: "s1", confidence: "medium" }); // 167 m
    expect(coordToStage({ lat: 0, lng: 0.005 }, coords)).toMatchObject({ stageId: "s1", confidence: "low" }); // 556 m
  });

  it("returns null when no stage has coordinates", () => {
    expect(coordToStage({ lat: 0, lng: 0 }, new Map())).toBeNull();
  });
});
