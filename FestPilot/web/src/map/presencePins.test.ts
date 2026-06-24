import { describe, it, expect } from "vitest";
import { coarsePresencePins, isOutsideVenue } from "./presencePins";
import type { MapTransform } from "./transform";
import type { CoarsePresenceDto, PresenceMemberDto } from "../data/types";

// Identity affine so geoToSvg(lng, lat) === [lng, lat] — keeps the placement maths obvious.
const transform: MapTransform = {
  festival: "f",
  venue: "De Schorre",
  canvas: { width: 1000, height: 1000 },
  bbox: { west: 4.0, east: 4.02, south: 51.0, north: 51.02 },
  affine: { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0 },
  stages: [
    { name: "MAINSTAGE", lng: 100, lat: 200, matched: true },
    { name: "CORE", lng: 300, lat: 400, matched: true },
  ],
  source: "OSM",
};

function coarse(over: Partial<CoarsePresenceDto> = {}): CoarsePresenceDto {
  return {
    coarseLabel: "at",
    stageName: "MAINSTAGE",
    betweenStageName: null,
    currentArtistName: null,
    confidence: "high",
    source: "gps",
    updatedAtUtc: "2026-06-24T20:00:00Z",
    stale: false,
    ageSeconds: 10,
    ...over,
  };
}

function member(over: Partial<PresenceMemberDto> = {}): PresenceMemberDto {
  return {
    userId: "u1",
    displayName: "Alice Adams",
    avatarColor: "#0EA5E9",
    role: "member",
    isYou: false,
    isTest: false,
    shareMode: "stage",
    live: false,
    liveSecondsLeft: null,
    presence: coarse(),
    ...over,
  };
}

describe("coarsePresencePins — privacy-correct, stage-anchored placement", () => {
  it("places an 'at STAGE' member exactly on that stage's projected point", () => {
    const pins = coarsePresencePins(transform, [member()]);
    expect(pins).toHaveLength(1);
    expect(pins[0]!.x).toBeCloseTo(100, 6);
    expect(pins[0]!.y).toBeCloseTo(200, 6);
    expect(pins[0]!.initials).toBe("AA");
  });

  it("never carries a raw coordinate — only screen x/y (DEC-058)", () => {
    const [pin] = coarsePresencePins(transform, [member()]);
    expect(pin).toBeDefined();
    expect(Object.keys(pin!)).not.toContain("lng");
    expect(Object.keys(pin!)).not.toContain("lat");
  });

  it("drops ghosts, members with no fix, and stale fixes (they belong in the roster, not the map)", () => {
    const pins = coarsePresencePins(transform, [
      member({ userId: "g", shareMode: "ghost" }),
      member({ userId: "n", presence: null }),
      member({ userId: "s", presence: coarse({ stale: true }) }),
    ]);
    expect(pins).toHaveLength(0);
  });

  it("fans two members on the same stage to distinct points", () => {
    const pins = coarsePresencePins(transform, [
      member({ userId: "a" }),
      member({ userId: "b", displayName: "Bob Brown" }),
    ]);
    expect(pins).toHaveLength(2);
    const first = pins[0]!;
    const second = pins[1]!;
    expect(first.x).toBeCloseTo(100, 6); // seat 0 sits on the anchor
    const moved = Math.hypot(second.x - first.x, second.y - first.y);
    expect(moved).toBeGreaterThan(5); // seat 1 is offset off the anchor
  });

  it("anchors a 'between A & B' member at the midpoint of the two stages", () => {
    const pins = coarsePresencePins(transform, [
      member({ presence: coarse({ coarseLabel: "between", stageName: "MAINSTAGE", betweenStageName: "CORE" }) }),
    ]);
    expect(pins[0]!.x).toBeCloseTo(200, 6); // (100 + 300) / 2
    expect(pins[0]!.y).toBeCloseTo(300, 6); // (200 + 400) / 2
  });

  it("marks 'you' with the accent colour + dark text", () => {
    const [pin] = coarsePresencePins(transform, [member({ isYou: true })]);
    expect(pin!.isYou).toBe(true);
    expect(pin!.color).toBe("var(--accent)");
    expect(pin!.darkText).toBe(true);
    expect(pin!.name).toBe("You");
  });
});

describe("isOutsideVenue — out-of-venue predicate (DEC-051)", () => {
  const { bbox } = transform;

  it("is false at the venue centre", () => {
    expect(isOutsideVenue(bbox, 4.01, 51.01)).toBe(false);
  });

  it("is false just inside the bbox (within the margin)", () => {
    expect(isOutsideVenue(bbox, 4.0005, 51.0005)).toBe(false);
  });

  it("is true far outside (a different town)", () => {
    expect(isOutsideVenue(bbox, 4.4, 51.2)).toBe(true);
    expect(isOutsideVenue(bbox, 3.5, 50.9)).toBe(true);
  });

  it("respects the margin: a point just beyond it counts as outside", () => {
    // ~1 km west of the bbox edge — well past the 150 m margin.
    expect(isOutsideVenue(bbox, 4.0 - 0.02, 51.01)).toBe(true);
  });
});
