import { describe, expect, it } from "vitest";
import { routeName, routeTitle } from "./routeTitle";

describe("routeName", () => {
  it("names the primary tabs", () => {
    expect(routeName("/")).toBe("Now");
    expect(routeName("/timetable")).toBe("Timetable");
    expect(routeName("/lineup")).toBe("Lineup");
    expect(routeName("/plan")).toBe("My Plan");
    expect(routeName("/map")).toBe("Map");
    expect(routeName("/squad")).toBe("Squad");
  });

  it("names stack screens and onboarding", () => {
    expect(routeName("/lockin")).toBe("Lock in");
    expect(routeName("/route")).toBe("Walking route");
    expect(routeName("/onboarding")).toBe("Welcome");
    expect(routeName("/settings")).toBe("Settings");
    expect(routeName("/settings/appearance")).toBe("Settings");
  });

  it("names squad sub-flows by suffix, generic Squad otherwise", () => {
    expect(routeName("/squad/abc123/board")).toBe("Squad board");
    expect(routeName("/squad/abc123/events")).toBe("Squad events");
    expect(routeName("/squad/abc123/share")).toBe("Share plan");
    expect(routeName("/squad/abc123/where")).toBe("Where's the squad");
    expect(routeName("/squad/abc123/meet")).toBe("Meeting point");
    expect(routeName("/squad/abc123/meet/mp1/nav")).toBe("Meeting point");
    expect(routeName("/squad/abc123/plan")).toBe("Squad plan");
    expect(routeName("/squad/abc123/plan/p1/split")).toBe("Squad plan");
    expect(routeName("/squad/join/tok")).toBe("Squad");
    expect(routeName("/squad/abc123/location")).toBe("Squad");
  });

  it("names admin and falls back to the app name for unknown routes", () => {
    expect(routeName("/admin")).toBe("Admin");
    expect(routeName("/admin/metrics")).toBe("Admin");
    expect(routeName("/totally-unknown")).toBe("FestPilot");
  });
});

describe("routeTitle", () => {
  it("appends the app name for known screens", () => {
    expect(routeTitle("/timetable")).toBe("Timetable · FestPilot");
    expect(routeTitle("/squad/abc123/board")).toBe("Squad board · FestPilot");
  });

  it("is just the app name for unknown routes (never doubled, never empty)", () => {
    expect(routeTitle("/totally-unknown")).toBe("FestPilot");
    expect(routeTitle("/")).toBe("Now · FestPilot");
  });
});
