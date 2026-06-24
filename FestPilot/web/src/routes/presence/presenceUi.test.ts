import { describe, expect, it } from "vitest";
import { ago, mmss, pingKindFor, presenceLine, rosterRank, sortRoster } from "./presenceUi";
import type { CoarsePresenceDto, PresenceMemberDto } from "../../data/types";

const FRESH: CoarsePresenceDto = {
  coarseLabel: "at",
  stageName: "MAINSTAGE",
  betweenStageName: null,
  currentArtistName: null,
  confidence: "high",
  source: "gps",
  updatedAtUtc: "2026-07-18T20:30:00Z",
  stale: false,
  ageSeconds: 10,
};

function member(over: Partial<PresenceMemberDto>, presence?: CoarsePresenceDto | null): PresenceMemberDto {
  return {
    userId: "u1",
    displayName: "Ana",
    avatarColor: "#FF5A36",
    role: "member",
    isYou: false,
    shareMode: "stage",
    live: false,
    liveSecondsLeft: null,
    presence: presence === undefined ? { ...FRESH } : presence,
    ...over,
  };
}

describe("ago", () => {
  it("collapses the last 45s to 'now'", () => {
    expect(ago(0)).toBe("now");
    expect(ago(44)).toBe("now");
  });

  it("rounds to whole minutes", () => {
    expect(ago(45)).toBe("1m");
    expect(ago(90)).toBe("2m");
    expect(ago(1080)).toBe("18m");
  });

  it("rolls over to hours at 60 minutes", () => {
    expect(ago(3600)).toBe("1h");
    expect(ago(7200)).toBe("2h");
  });
});

describe("mmss", () => {
  it("formats a precise-sharing countdown", () => {
    expect(mmss(0)).toBe("0:00");
    expect(mmss(5)).toBe("0:05");
    expect(mmss(60)).toBe("1:00");
    expect(mmss(2852)).toBe("47:32");
  });

  it("clamps negatives to zero", () => {
    expect(mmss(-9)).toBe("0:00");
  });
});

describe("presenceLine", () => {
  it("ghost mode reads as not sharing, muted", () => {
    const line = presenceLine(member({ shareMode: "ghost" }, null));
    expect(line.text).toBe("not sharing");
    expect(line.icon).toBe("visibility_off");
    expect(line.muted).toBe(true);
  });

  it("distinguishes 'you' vs others when there's no fix yet", () => {
    expect(presenceLine(member({ isYou: true }, null)).text).toBe("share to appear");
    expect(presenceLine(member({ isYou: false }, null)).text).toBe("no location yet");
  });

  it("shows a coarse 'last seen' for a stale fix", () => {
    const line = presenceLine(member({}, { ...FRESH, stale: true, ageSeconds: 1080 }));
    expect(line.text).toBe("last seen 18m ago");
    expect(line.muted).toBe(true);
  });

  it("labels 'at <stage>' and surfaces the current artist", () => {
    const line = presenceLine(member({}, { ...FRESH, currentArtistName: "Martin Garrix" }));
    expect(line.text).toBe("at MAINSTAGE");
    expect(line.sub).toBe("watching Martin Garrix");
    expect(line.muted).toBe(false);
  });

  it("labels 'near' and 'between' honestly", () => {
    expect(presenceLine(member({}, { ...FRESH, coarseLabel: "near", stageName: "FOOD COURT B" })).text).toBe(
      "near FOOD COURT B"
    );
    expect(
      presenceLine(member({}, { ...FRESH, coarseLabel: "between", stageName: "CORE", betweenStageName: "MAINSTAGE" }))
        .text
    ).toBe("between CORE & MAINSTAGE");
  });

  it("falls back to a vague venue label when no stage resolves", () => {
    expect(presenceLine(member({}, { ...FRESH, coarseLabel: "none", stageName: null })).text).toBe(
      "somewhere in the venue"
    );
  });

  it("a live sharer shows the precise countdown clause over the artist", () => {
    const line = presenceLine(member({ live: true, liveSecondsLeft: 2820 }, { ...FRESH, currentArtistName: "Anyma" }));
    expect(line.sub).toBe("precise · 47m left");
    expect(line.icon).toBe("my_location");
  });
});

describe("rosterRank", () => {
  it("buckets live > fresh > stale > ghost/no-fix", () => {
    expect(rosterRank(member({ live: true }))).toBe(0);
    expect(rosterRank(member({}))).toBe(1); // fresh sharer (FRESH presence)
    expect(rosterRank(member({}, { ...FRESH, stale: true }))).toBe(2);
    expect(rosterRank(member({ shareMode: "ghost" }, null))).toBe(3);
    expect(rosterRank(member({}, null))).toBe(3); // sharing but no fix yet
  });
});

describe("sortRoster", () => {
  it("orders by bucket, then freshest-first, without mutating the input", () => {
    const ghost = member({ userId: "g", shareMode: "ghost" }, null);
    const stale = member({ userId: "s" }, { ...FRESH, stale: true, ageSeconds: 4000 });
    const fresh10 = member({ userId: "f10" }, { ...FRESH, ageSeconds: 10 });
    const fresh90 = member({ userId: "f90" }, { ...FRESH, ageSeconds: 90 });
    const live = member({ userId: "L", live: true, liveSecondsLeft: 1800 });
    const input = [ghost, stale, fresh90, live, fresh10];

    const out = sortRoster(input);

    expect(out.map((m) => m.userId)).toEqual(["L", "f10", "f90", "s", "g"]);
    // non-mutating: original order preserved
    expect(input.map((m) => m.userId)).toEqual(["g", "s", "f90", "L", "f10"]);
  });
});

describe("pingKindFor", () => {
  it("never offers to ping yourself", () => {
    expect(pingKindFor(member({ isYou: true, shareMode: "ghost" }, null))).toBeNull();
    expect(pingKindFor(member({ isYou: true }, { ...FRESH, stale: true }))).toBeNull();
  });

  it("nudges a ghost or a sharer with no fix yet", () => {
    expect(pingKindFor(member({ shareMode: "ghost" }, null))).toBe("nudge");
    expect(pingKindFor(member({ shareMode: "stage" }, null))).toBe("nudge");
  });

  it("locates a stale sharer but leaves fresh ones alone", () => {
    expect(pingKindFor(member({}, { ...FRESH, stale: true }))).toBe("locate");
    expect(pingKindFor(member({}, { ...FRESH, stale: false }))).toBeNull();
  });
});
