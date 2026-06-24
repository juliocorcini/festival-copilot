// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildTravelMatrix, coordToStage, metersBetween, type LatLng } from "./travel";

describe("metersBetween", () => {
  it("measures east-west distance at the equator (k = 1)", () => {
    // 0.003° lng at the equator ≈ 333.96 m.
    expect(metersBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 0.003 })).toBeCloseTo(333.96, 0);
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
