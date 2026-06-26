// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { PerformanceDto, StageDto, WeekendDto } from "../data/types";
import { uniqueActs } from "./lineup";
import { buildArtistDetail } from "./artistDetail";

const TZ = "Europe/Brussels"; // July → UTC+2, so 18:00Z is 20:00 local.

const stages: StageDto[] = [
  { id: "stage-main", sourceStageId: "1", name: "MAINSTAGE", sortOrder: 0 },
  { id: "stage-cage", sourceStageId: "2", name: "CAGE", sortOrder: 1 },
];

const weekends: WeekendDto[] = [
  { id: "W1", name: "W1", startDate: null, endDate: null },
  { id: "W2", name: "W2", startDate: null, endDate: null },
];

function perf(over: Partial<PerformanceDto>): PerformanceDto {
  return {
    id: "p-1",
    sourcePerformanceId: "sp-1",
    name: "Afrojack",
    day: "SATURDAY",
    dateLocal: "2026-07-18",
    weekendId: "W1",
    stageId: "stage-main",
    startAtUtc: "2026-07-18T20:00:00.000Z",
    endAtUtc: "2026-07-18T21:00:00.000Z",
    isPlaceholder: false,
    artists: [{ id: "a-afrojack", name: "Afrojack", imageUrl: null }],
    ...over,
  };
}

describe("buildArtistDetail (ART-4)", () => {
  it("lists every stage/time an artist plays, ordered by start, in the festival timezone", () => {
    // Same artist on two stages; the set listed FIRST starts later → output must reorder it last.
    const mainLate = perf({
      id: "p-main",
      stageId: "stage-main",
      startAtUtc: "2026-07-18T20:00:00.000Z", // 22:00 Brussels
      endAtUtc: "2026-07-18T21:30:00.000Z", // 23:30 Brussels
      artists: [
        { id: "a-afrojack", name: "Afrojack", imageUrl: "https://cdn/afrojack.jpg", socials: { instagram: "https://instagram.com/afrojack" } },
      ],
    });
    const cageEarly = perf({
      id: "p-cage",
      stageId: "stage-cage",
      startAtUtc: "2026-07-18T18:00:00.000Z", // 20:00 Brussels
      endAtUtc: "2026-07-18T19:00:00.000Z", // 21:00 Brussels
      artists: [{ id: "a-afrojack", name: "Afrojack", imageUrl: null }],
    });

    const act = uniqueActs([mainLate, cageEarly])[0]!;
    const detail = buildArtistDetail(act, stages, weekends, TZ);

    expect(detail.name).toBe("Afrojack");
    expect(detail.imageUrl).toBe("https://cdn/afrojack.jpg"); // first non-null wins
    expect(detail.slots).toHaveLength(2);

    // Reordered by start: CAGE 20:00 first, MAINSTAGE 22:00 second.
    const [first, second] = detail.slots;
    expect(first!.stageName).toBe("CAGE");
    expect(first!.start).toBe("20:00");
    expect(first!.end).toBe("21:00");
    expect(first!.stageColorKey).toBe("var(--s-cage)");
    expect(first!.dayLabel).toBe("Saturday");
    expect(first!.dateLabel).toBe("Jul 18");
    expect(first!.weekendName).toBe("W1");

    expect(second!.stageName).toBe("MAINSTAGE");
    expect(second!.start).toBe("22:00");
    expect(second!.end).toBe("23:30");
    expect(second!.stageColorKey).toBe("var(--s-main)");
  });

  it("carries only the present social links", () => {
    const withSocials = perf({
      artists: [{ id: "a-x", name: "X", imageUrl: null, socials: { instagram: "https://ig/x", spotify: "https://sp/x" } }],
    });
    const detail = buildArtistDetail(uniqueActs([withSocials])[0]!, stages, weekends, TZ);
    expect(detail.socials).toEqual({ instagram: "https://ig/x", spotify: "https://sp/x" });
    expect(detail.socials.facebook).toBeUndefined();
  });

  it("degrades to an empty socials object and no photo when the artist has neither", () => {
    const bare = perf({ artists: [{ id: "a-bare", name: "Bare", imageUrl: null }] });
    const detail = buildArtistDetail(uniqueActs([bare])[0]!, stages, weekends, TZ);
    expect(detail.socials).toEqual({});
    expect(detail.imageUrl).toBeNull();
    expect(detail.slots).toHaveLength(1);
  });

  it("labels the correct weekend and date for a second-weekend set", () => {
    const w2 = perf({
      id: "p-w2",
      weekendId: "W2",
      startAtUtc: "2026-07-25T21:00:00.000Z", // 23:00 Brussels, Sat Jul 25
      endAtUtc: "2026-07-25T22:00:00.000Z",
      artists: [{ id: "a-w2", name: "W2 Act", imageUrl: null }],
    });
    const detail = buildArtistDetail(uniqueActs([w2])[0]!, stages, weekends, TZ);
    expect(detail.slots).toHaveLength(1);
    expect(detail.slots[0]!.weekendName).toBe("W2");
    expect(detail.slots[0]!.dateLabel).toBe("Jul 25");
    expect(detail.slots[0]!.start).toBe("23:00");
  });

  it("drops placeholders and invalid windows (no slot without a real time)", () => {
    const placeholder = perf({
      id: "p-ph",
      isPlaceholder: true,
      artists: [{ id: "a-ph", name: "MTBA", imageUrl: null }],
    });
    const act = uniqueActs([placeholder], { includePlaceholders: true })[0]!;
    expect(buildArtistDetail(act, stages, weekends, TZ).slots).toHaveLength(0);
  });
});
