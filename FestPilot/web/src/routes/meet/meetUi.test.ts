import { describe, expect, it } from "vitest";

import type { MeetingPointDto, MeetingPointMemberDto } from "../../data/types";
import {
  closesInLabel,
  convergenceSummary,
  etaLabel,
  formatMeters,
  lifecycleBadge,
  memberStatusLine,
  whenLabel,
} from "./meetUi";

function member(partial: Partial<MeetingPointMemberDto>): MeetingPointMemberDto {
  return {
    userId: "u1",
    displayName: "Ana",
    avatarColor: "#FF5A36",
    isYou: false,
    status: "going",
    updatedAtUtc: "2026-07-18T20:30:00Z",
    etaMinutes: null,
    distanceMeters: null,
    ...partial,
  };
}

function point(partial: Partial<MeetingPointDto>): MeetingPointDto {
  return {
    id: "mp1",
    groupId: "g1",
    createdByUserId: "u-you",
    createdByName: "Julio",
    isMine: true,
    title: "Regroup",
    note: null,
    photoUrl: null,
    lat: 51,
    lng: 4,
    landmarkLabel: "near CORE",
    meetAtUtc: null,
    expiresAtUtc: "2026-07-18T21:00:00Z",
    createdAtUtc: "2026-07-18T20:30:00Z",
    members: [],
    goingCount: 0,
    hereCount: 0,
    myStatus: null,
    lifecycle: "active",
    everyoneHere: false,
    creatorDrifted: false,
    isSafety: false,
    ...partial,
  };
}

describe("meetUi — lifecycle badge", () => {
  it("maps each lifecycle state to a label + tone", () => {
    expect(lifecycleBadge("active")).toEqual({ label: "Active", tone: "active" });
    expect(lifecycleBadge("on_the_way")).toEqual({ label: "On the way", tone: "go" });
    expect(lifecycleBadge("everyone_here")).toEqual({ label: "Everyone's here", tone: "done" });
    expect(lifecycleBadge("expiring_soon")).toEqual({ label: "Closing soon", tone: "warn" });
    expect(lifecycleBadge("expired")).toEqual({ label: "Closed", tone: "dead" });
    expect(lifecycleBadge("cancelled")).toEqual({ label: "Cancelled", tone: "dead" });
  });
});

describe("meetUi — member status line", () => {
  it("'Here' (green) for an arrived member", () => {
    expect(memberStatusLine(member({ status: "arrived" }))).toEqual({ text: "Here", tone: "here", icon: "check" });
  });

  it("ETA + distance for a member heading over with a fix", () => {
    const line = memberStatusLine(member({ status: "going", etaMinutes: 3, distanceMeters: 220 }));
    expect(line).toEqual({ text: "~3 min · 220m", tone: "eta", icon: null });
  });

  it("'on the way' (no ETA) for a going member without a fix", () => {
    expect(memberStatusLine(member({ status: "going", etaMinutes: null }))).toEqual({
      text: "on the way",
      tone: "eta",
      icon: "directions_walk",
    });
  });

  it("'no response' (muted) for a non-responder", () => {
    expect(memberStatusLine(member({ status: "no_response" }))).toEqual({ text: "no response", tone: "muted", icon: null });
  });

  it("'Can't make it' for a not_going member", () => {
    expect(memberStatusLine(member({ status: "not_going" })).tone).toBe("cant");
  });
});

describe("meetUi — formatting", () => {
  it("etaLabel pairs minutes with a rounded distance, or minutes alone", () => {
    expect(etaLabel(3, 220)).toBe("~3 min · 220m");
    expect(etaLabel(5, null)).toBe("~5 min");
  });

  it("formatMeters rounds to 10 m and switches to km past 1000 m", () => {
    expect(formatMeters(217)).toBe("220m");
    expect(formatMeters(4)).toBe("10m"); // floored so it never reads "0m"
    expect(formatMeters(1240)).toBe("1.2km");
  });

  it("whenLabel reads 'now' for a meet-now point", () => {
    expect(whenLabel(null)).toBe("now");
    expect(whenLabel("not-a-date")).toBe("now");
  });
});

describe("meetUi — convergence summary", () => {
  it("'Everyone's here' wins", () => {
    expect(convergenceSummary(point({ everyoneHere: true, goingCount: 0, hereCount: 3 }))).toBe("Everyone's here");
  });

  it("'N on the way · M here' once someone arrived", () => {
    expect(convergenceSummary(point({ goingCount: 3, hereCount: 1 }))).toBe("3 on the way · 1 here");
  });

  it("'N going' before anyone arrives", () => {
    expect(convergenceSummary(point({ goingCount: 1, hereCount: 0 }))).toBe("1 going");
  });
});

describe("meetUi — closes-in label", () => {
  const now = Date.parse("2026-07-18T20:30:00Z");

  it("minutes when close, hours when further, null when far off", () => {
    expect(closesInLabel("2026-07-18T20:54:00Z", now)).toBe("closes in 24m");
    expect(closesInLabel("2026-07-18T22:30:00Z", now)).toBe("closes in 2h");
    expect(closesInLabel("2026-07-19T10:30:00Z", now)).toBeNull(); // > 6 h out
  });

  it("'closing' once expiry has passed", () => {
    expect(closesInLabel("2026-07-18T20:29:00Z", now)).toBe("closing");
  });
});
