import { describe, expect, it } from "vitest";
import { ago, mmss, presenceLine } from "./presenceUi";
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
