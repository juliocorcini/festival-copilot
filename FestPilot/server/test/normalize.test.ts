import { describe, expect, it } from "vitest";

import {
  buildNormalizedLineup,
  floorSeconds,
  overlaps,
  toInstant,
} from "../src/lineup/normalize";
import type { Performance, SourceConfig, SourceStages, SourceWeekendFile } from "../src/lineup/types";
import { buildFixturePayload } from "./fixtures";

function normalizedFromFixtures() {
  const payload = buildFixturePayload();
  return buildNormalizedLineup({
    event: payload.ref.event,
    uuid: payload.ref.uuid,
    config: JSON.parse(payload.configText) as SourceConfig,
    stages: JSON.parse(payload.stagesText) as SourceStages,
    weekendFiles: payload.weekendTexts.map((w) => ({
      name: w.name,
      file: JSON.parse(w.text) as SourceWeekendFile,
    })),
  });
}

describe("floorSeconds (+1s end-time quirk)", () => {
  it("floors a non-zero seconds end time and flags it", () => {
    const { iso, fixed } = floorSeconds("2026-07-17 23:00:01+02:00");
    expect(fixed).toBe(true);
    expect(iso).toBe("2026-07-17T23:00:00+02:00");
  });

  it("leaves an exact-minute end time untouched", () => {
    const { iso, fixed } = floorSeconds("2026-07-17 23:00:00+02:00");
    expect(fixed).toBe(false);
    expect(iso).toBe("2026-07-17T23:00:00+02:00");
  });
});

describe("toInstant", () => {
  it("parses a space-separated offset datetime into the correct UTC instant", () => {
    const d = toInstant("2026-07-17 21:00:00+02:00");
    expect(d.toISOString()).toBe("2026-07-17T19:00:00.000Z"); // +02:00 -> UTC is 2h earlier
  });
});

describe("buildNormalizedLineup on real fixtures", () => {
  const lineup = normalizedFromFixtures();

  it("has two weekends and a non-trivial set of stages and performances", () => {
    expect(lineup.weekends.map((w) => w.name).sort()).toEqual(["W1", "W2"]);
    expect(lineup.stages.length).toBeGreaterThan(5);
    expect(lineup.performances.length).toBeGreaterThan(100);
    expect(lineup.timezone).toBe("Europe/Brussels");
  });

  it("stores every instant in UTC and as the correct moment", () => {
    for (const p of lineup.performances) {
      expect(p.startAt.toISOString()).toMatch(/Z$/);
      expect(p.startAt.getTime()).toBe(new Date(p.rawStartTime.replace(" ", "T")).getTime());
    }
  });

  it("applies the Brussels +02:00 offset (local -> UTC is 2h earlier)", () => {
    const sample = lineup.performances.find((p) => p.rawStartTime.includes("+02:00"));
    expect(sample).toBeDefined();
    const localHour = Number(sample!.rawStartTime.slice(11, 13));
    expect(sample!.startAt.getUTCHours()).toBe((localHour - 2 + 24) % 24);
  });

  it("corrects the +1s quirk for at least some sets and handles midnight crossings", () => {
    expect(lineup.performances.some((p) => p.endTimeFixed)).toBe(true);
    expect(lineup.performances.some((p) => p.crossesMidnight)).toBe(true);
  });

  it("returns performances sorted by start instant", () => {
    for (let i = 1; i < lineup.performances.length; i++) {
      expect(lineup.performances[i]!.startAt.getTime()).toBeGreaterThanOrEqual(
        lineup.performances[i - 1]!.startAt.getTime()
      );
    }
  });
});

describe("overlaps (Pillar 2 clash core)", () => {
  const at = (s: string, e: string) =>
    ({ startAt: new Date(s), endAt: new Date(e) }) as unknown as Performance;

  it("detects overlapping intervals and ignores adjacent ones", () => {
    const a = at("2026-07-17T19:00:00Z", "2026-07-17T20:00:00Z");
    const b = at("2026-07-17T19:30:00Z", "2026-07-17T20:30:00Z");
    const c = at("2026-07-17T20:00:00Z", "2026-07-17T21:00:00Z");
    expect(overlaps(a, b)).toBe(true);
    expect(overlaps(a, c)).toBe(false); // touching at 20:00 is not an overlap
  });
});
