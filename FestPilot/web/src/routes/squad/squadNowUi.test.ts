import { describe, it, expect } from "vitest";
import type { MeetingPointDto, PresenceMemberDto } from "../../data/types";
import type { RosterPlace } from "../presence/presenceUi";
import { firstActivePoint, pointBadge, presenceSummary } from "./squadNowUi";

/** presenceSummary only reads each place's kind/label and member COUNT, so members can be light. */
const member = (): PresenceMemberDto => ({}) as PresenceMemberDto;
function place(kind: RosterPlace["kind"], label: string, count: number): RosterPlace {
  return {
    key: `${kind}:${label}`,
    label,
    kind,
    stageName: kind === "stage" ? label : null,
    hasYou: false,
    members: Array.from({ length: count }, member),
  };
}

const point = (p: Partial<MeetingPointDto>): MeetingPointDto =>
  ({ lifecycle: "active", isSafety: false, everyoneHere: false, ...p }) as MeetingPointDto;

describe("presenceSummary", () => {
  it("summarises the top two live places and tallies the rest as overflow", () => {
    const places = [place("stage", "FREEDOM", 3), place("between", "A & B", 1), place("venue", "In the venue", 2)];
    expect(presenceSummary(places)).toEqual({ text: "3 at FREEDOM \u00B7 1 between A & B \u00B7 +2 more", muted: false });
  });

  it("ignores the location-off bucket entirely", () => {
    const places = [place("stage", "CORE", 2), place("off", "Location off", 5)];
    expect(presenceSummary(places)).toEqual({ text: "2 at CORE", muted: false });
  });

  it("labels the vague-venue bucket without a stage name", () => {
    expect(presenceSummary([place("venue", "In the venue", 1)]).text).toBe("1 in the venue");
  });

  it("falls back to a muted line when nobody is sharing a live spot", () => {
    expect(presenceSummary([place("off", "Location off", 4)])).toEqual({
      text: "No one's sharing their spot yet",
      muted: true,
    });
    expect(presenceSummary([])).toEqual({ text: "No one's sharing their spot yet", muted: true });
  });
});

describe("pointBadge", () => {
  it("flags a safety broadcast above every other state", () => {
    expect(pointBadge(point({ isSafety: true, everyoneHere: true, lifecycle: "everyone_here" }))).toEqual({
      label: "Safety",
      tone: "warn",
    });
  });

  it("maps everyone-here, expiring-soon and the default to their tones", () => {
    expect(pointBadge(point({ everyoneHere: true }))).toEqual({ label: "All here", tone: "go" });
    expect(pointBadge(point({ lifecycle: "everyone_here" }))).toEqual({ label: "All here", tone: "go" });
    expect(pointBadge(point({ lifecycle: "expiring_soon" }))).toEqual({ label: "Wrapping up", tone: "warn" });
    expect(pointBadge(point({ lifecycle: "active" }))).toEqual({ label: "Meeting point", tone: "go" });
    expect(pointBadge(point({ lifecycle: "on_the_way" }))).toEqual({ label: "Meeting point", tone: "go" });
  });
});

describe("firstActivePoint", () => {
  it("returns the first point that is neither expired nor cancelled", () => {
    const points = [
      point({ id: "a", lifecycle: "expired" }),
      point({ id: "b", lifecycle: "on_the_way" }),
      point({ id: "c", lifecycle: "active" }),
    ];
    expect(firstActivePoint(points)?.id).toBe("b");
  });

  it("returns null when every point is closed", () => {
    expect(firstActivePoint([point({ lifecycle: "expired" }), point({ lifecycle: "cancelled" })])).toBeNull();
  });
});
