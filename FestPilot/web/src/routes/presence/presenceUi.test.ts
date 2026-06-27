import { describe, expect, it } from "vitest";
import {
  ago,
  groupRosterByStage,
  mapsDirectionsUrl,
  mmss,
  pingKindFor,
  presenceLine,
  rosterRank,
  sortRoster,
} from "./presenceUi";
import { translate, type TranslateFn } from "../../i18n";
import type { CoarsePresenceDto, PrecisePresenceDto, PresenceMemberDto } from "../../data/types";

// Tests assert the English source-of-truth strings (the PT overlay is exercised by translate()).
const t: TranslateFn = (key, vars) => translate("en", key, vars);

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
    isTest: false,
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
    const line = presenceLine(member({ shareMode: "ghost" }, null), t);
    expect(line.text).toBe("not sharing");
    expect(line.icon).toBe("visibility_off");
    expect(line.muted).toBe(true);
  });

  it("distinguishes 'you' vs others when there's no fix yet", () => {
    expect(presenceLine(member({ isYou: true }, null), t).text).toBe("share to appear");
    expect(presenceLine(member({ isYou: false }, null), t).text).toBe("no location yet");
  });

  it("shows a coarse 'last seen' for a stale fix", () => {
    const line = presenceLine(member({}, { ...FRESH, stale: true, ageSeconds: 1080 }), t);
    expect(line.text).toBe("last seen 18m ago");
    expect(line.muted).toBe(true);
  });

  it("labels 'at <stage>' and surfaces the current artist", () => {
    const line = presenceLine(member({}, { ...FRESH, currentArtistName: "Martin Garrix" }), t);
    expect(line.text).toBe("at MAINSTAGE");
    expect(line.sub).toBe("watching Martin Garrix");
    expect(line.muted).toBe(false);
  });

  it("labels 'near' and 'between' honestly", () => {
    expect(presenceLine(member({}, { ...FRESH, coarseLabel: "near", stageName: "FOOD COURT B" }), t).text).toBe(
      "near FOOD COURT B"
    );
    expect(
      presenceLine(member({}, { ...FRESH, coarseLabel: "between", stageName: "CORE", betweenStageName: "MAINSTAGE" }), t)
        .text
    ).toBe("between CORE & MAINSTAGE");
  });

  it("falls back to a vague venue label when no stage resolves", () => {
    expect(presenceLine(member({}, { ...FRESH, coarseLabel: "none", stageName: null }), t).text).toBe(
      "somewhere in the venue"
    );
  });

  it("a live sharer shows the precise countdown clause over the artist", () => {
    const line = presenceLine(member({ live: true, liveSecondsLeft: 2820 }, { ...FRESH, currentArtistName: "Anyma" }), t);
    expect(line.sub).toBe("precise · 47m left");
    expect(line.icon).toBe("my_location");
  });

  it("an exact pin (DEC-099) reads 'exact · Nm ago' and overrides a stale coarse fix", () => {
    const precise: PrecisePresenceDto = {
      userId: "u1",
      lat: 51,
      lng: 4,
      accuracyMeters: 10,
      expiresAtUtc: "2026-07-18T21:00:00Z",
      updatedAtUtc: "2026-07-18T20:28:00Z",
      ageSeconds: 120,
    };
    const line = presenceLine(member({ live: true }, { ...FRESH, stale: true }), t, precise);
    expect(line.sub).toBe("exact · 2m ago");
    expect(line.icon).toBe("my_location");
    expect(line.muted).toBe(false); // a fresh exact pin is never muted, even over a stale coarse fix
  });

  it("translates the line into the Portuguese overlay", () => {
    const pt: TranslateFn = (key, vars) => translate("pt", key, vars);
    const line = presenceLine(member({}, { ...FRESH, currentArtistName: "Anyma" }), pt);
    expect(line.text).toBe("no MAINSTAGE");
    expect(line.sub).toBe("assistindo Anyma");
  });
});

describe("mapsDirectionsUrl", () => {
  it("builds a platform maps directions deep link to the exact coordinate", () => {
    expect(mapsDirectionsUrl(51.0, 4.00571)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=51,4.00571"
    );
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

describe("groupRosterByStage", () => {
  it("clusters members by coarse stage, busiest first, and flags the group that has you", () => {
    const you = member({ userId: "you", isYou: true }, { ...FRESH, stageName: "MAINSTAGE" });
    const ana = member({ userId: "ana" }, { ...FRESH, stageName: "MAINSTAGE" });
    const theo = member({ userId: "theo" }, { ...FRESH, stageName: "MAINSTAGE" });
    const lu = member({ userId: "lu" }, { ...FRESH, coarseLabel: "near", stageName: "CAGE" });

    const places = groupRosterByStage([lu, you, ana, theo]);

    expect(places.map((p) => p.label)).toEqual(["MAINSTAGE", "CAGE"]);
    expect(places[0]!.members.map((m) => m.userId)).toEqual(["you", "ana", "theo"]);
    expect(places[0]!.hasYou).toBe(true);
    expect(places[1]!.hasYou).toBe(false);
    expect(places[1]!.stageName).toBe("CAGE");
  });

  it("labels a between-pair and orders it after stages", () => {
    const onStage = member({ userId: "s" }, { ...FRESH, stageName: "CORE" });
    const between = member(
      { userId: "b" },
      { ...FRESH, coarseLabel: "between", stageName: "CAGE", betweenStageName: "FREEDOM" }
    );

    const places = groupRosterByStage([between, onStage]);

    expect(places.map((p) => p.kind)).toEqual(["stage", "between"]);
    expect(places[1]!.label).toBe("CAGE & FREEDOM");
  });

  it("sinks ghosts, no-fix and stale members into a single muted 'Location off' bucket, last", () => {
    const fresh = member({ userId: "f" }, { ...FRESH, stageName: "MAINSTAGE" });
    const ghost = member({ userId: "g", shareMode: "ghost" }, null);
    const noFix = member({ userId: "n" }, null);
    const stale = member({ userId: "s" }, { ...FRESH, stale: true });

    const places = groupRosterByStage([fresh, ghost, noFix, stale]);

    const off = places.at(-1)!;
    expect(off.kind).toBe("off");
    expect(off.label).toBe("Location off");
    expect(off.members.map((m) => m.userId).sort()).toEqual(["g", "n", "s"]);
    expect(off.stageName).toBeNull();
  });

  it("buckets a resolved-but-stageless fix as 'In the venue'", () => {
    const venue = member({ userId: "v" }, { ...FRESH, coarseLabel: "none", stageName: null });
    const places = groupRosterByStage([venue]);
    expect(places).toHaveLength(1);
    expect(places[0]!.kind).toBe("venue");
    expect(places[0]!.label).toBe("In the venue");
  });

  it("returns nothing for an empty roster and never mutates the input", () => {
    const input = [member({ userId: "a" }, { ...FRESH }), member({ userId: "b" }, null)];
    const snapshot = input.map((m) => m.userId);
    groupRosterByStage(input);
    expect(groupRosterByStage([])).toEqual([]);
    expect(input.map((m) => m.userId)).toEqual(snapshot);
  });
});
