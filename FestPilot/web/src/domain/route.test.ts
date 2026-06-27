import { describe, expect, it } from "vitest";
import { buildRouteLeg, chooseRouteStages, type RouteEndpoint } from "./route";
import type { TravelMatrix } from "./types";

const fixed = (minutes: number): TravelMatrix => ({ minutesBetween: () => minutes });

const main: RouteEndpoint = { stageId: "main", stageName: "MAINSTAGE", coord: { lat: 51.0921683, lng: 4.3864793 } };
const cage: RouteEndpoint = { stageId: "cage", stageName: "CAGE", coord: { lat: 51.0887504, lng: 4.3826684 } };
const noCoord: RouteEndpoint = { stageId: "ghost", stageName: "GHOST", coord: null };

describe("buildRouteLeg", () => {
  it("takes the walk minutes from the matrix", () => {
    const leg = buildRouteLeg(main, cage, fixed(7));
    expect(leg.minutes).toBe(7);
  });

  it("reports straight-line metres between coordinates for display", () => {
    const leg = buildRouteLeg(main, cage, fixed(7));
    // ~470 m between MAINSTAGE and CAGE at De Schorre.
    expect(leg.meters).toBeGreaterThan(400);
    expect(leg.meters).toBeLessThan(560);
  });

  it("returns null metres when either endpoint lacks coordinates", () => {
    expect(buildRouteLeg(main, noCoord, fixed(8)).meters).toBeNull();
    expect(buildRouteLeg(noCoord, cage, fixed(8)).meters).toBeNull();
  });

  it("derives leaveBy by subtracting the walk from the target arrival", () => {
    const arrive = Date.parse("2026-07-17T21:00:00Z");
    const leg = buildRouteLeg(main, cage, fixed(7), arrive);
    expect(leg.arriveByMs).toBe(arrive);
    expect(leg.leaveByMs).toBe(arrive - 7 * 60_000);
  });

  it("leaves leaveBy null for an ad-hoc route with no target time", () => {
    expect(buildRouteLeg(main, cage, fixed(7)).leaveByMs).toBeNull();
  });

  it("collapses a same-stage leg to zero minutes and metres without hitting the matrix", () => {
    const leg = buildRouteLeg(main, { ...main }, fixed(99));
    expect(leg.minutes).toBe(0);
    expect(leg.meters).toBe(0);
  });
});

describe("chooseRouteStages (DEC-079 — never Mainstage → Mainstage)", () => {
  const ids = ["main", "cage", "freedom"];

  it("keeps an explicit, distinct from/to", () => {
    expect(chooseRouteStages("main", "freedom", ids)).toEqual({ fromId: "main", toId: "freedom" });
  });

  it("substitutes a different destination when to equals from", () => {
    // The exact bug: a recomputed leg that points a stage at itself must resolve to a real walk.
    expect(chooseRouteStages("main", "main", ids)).toEqual({ fromId: "main", toId: "cage" });
  });

  it("defaults from to the first stage and picks a distinct to when both are missing", () => {
    expect(chooseRouteStages(null, null, ids)).toEqual({ fromId: "main", toId: "cage" });
  });

  it("honors an explicit destination even when the origin is defaulted", () => {
    expect(chooseRouteStages(null, "freedom", ids)).toEqual({ fromId: "main", toId: "freedom" });
  });

  it("returns nulls with no stages to choose from", () => {
    expect(chooseRouteStages(null, null, [])).toEqual({ fromId: null, toId: null });
  });

  it("falls back to the only stage's id for from, with no distinct destination available", () => {
    expect(chooseRouteStages(null, null, ["solo"])).toEqual({ fromId: "solo", toId: null });
  });
});
