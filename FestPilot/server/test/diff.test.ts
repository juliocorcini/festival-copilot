import { describe, expect, it } from "vitest";

import { diffLineup, type ExistingPerformance, type IncomingPerformance } from "../src/ingest/diff";

const existing = (over: Partial<ExistingPerformance> & { sourcePerformanceId: string }): ExistingPerformance => ({
  id: `id_${over.sourcePerformanceId}`,
  stageSourceId: "stage_a",
  startAtUtc: "2026-07-17T19:00:00.000Z",
  endAtUtc: "2026-07-17T20:00:00.000Z",
  artistSourceIds: ["art_1"],
  active: true,
  ...over,
});

const incoming = (over: Partial<IncomingPerformance> & { sourcePerformanceId: string }): IncomingPerformance => ({
  name: "Set",
  stageSourceId: "stage_a",
  startAtUtc: "2026-07-17T19:00:00.000Z",
  endAtUtc: "2026-07-17T20:00:00.000Z",
  artistSourceIds: ["art_1"],
  ...over,
});

describe("diffLineup", () => {
  it("reports no changes when nothing differs", () => {
    expect(diffLineup([existing({ sourcePerformanceId: "p1" })], [incoming({ sourcePerformanceId: "p1" })])).toEqual([]);
  });

  it("detects added performances (including against an empty database)", () => {
    const changes = diffLineup([], [incoming({ sourcePerformanceId: "p1" }), incoming({ sourcePerformanceId: "p2" })]);
    expect(changes).toHaveLength(2);
    expect(changes.every((c) => c.changeType === "added")).toBe(true);
  });

  it("detects removed performances (active, absent from incoming)", () => {
    const changes = diffLineup([existing({ sourcePerformanceId: "p1" })], []);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changeType).toBe("removed");
    expect(changes[0]!.performanceId).toBe("id_p1");
  });

  it("detects time, stage and artist changes (possibly several for one act)", () => {
    const changes = diffLineup(
      [existing({ sourcePerformanceId: "p1" })],
      [
        incoming({
          sourcePerformanceId: "p1",
          endAtUtc: "2026-07-17T20:30:00.000Z",
          stageSourceId: "stage_b",
          artistSourceIds: ["art_1", "art_2"],
        }),
      ]
    );
    const types = changes.map((c) => c.changeType).sort();
    expect(types).toEqual(["artist_changed", "stage_changed", "time_changed"]);
  });

  it("treats a previously-inactive act present again as added", () => {
    const changes = diffLineup(
      [existing({ sourcePerformanceId: "p1", active: false })],
      [incoming({ sourcePerformanceId: "p1" })]
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]!.changeType).toBe("added");
  });

  it("ignores artist ordering when comparing", () => {
    const changes = diffLineup(
      [existing({ sourcePerformanceId: "p1", artistSourceIds: ["art_1", "art_2"] })],
      [incoming({ sourcePerformanceId: "p1", artistSourceIds: ["art_2", "art_1"] })]
    );
    expect(changes).toEqual([]);
  });
});
