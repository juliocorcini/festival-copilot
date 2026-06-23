import { describe, expect, it } from "vitest";

import { ingest } from "../src/ingest/ingest";
import type { SourceWeekendFile } from "../src/lineup/types";
import { buildFixturePayload, FixtureLineupFetcher } from "./fixtures";
import { InMemoryLineupStore } from "./in-memory-store";
import type { RawLineupPayload } from "../src/ingest/source";

const festival = {
  name: "Tomorrowland Belgium 2026",
  slug: "tomorrowland-belgium-2026",
  timezone: "Europe/Brussels",
};
const fixedNow = () => new Date("2026-06-23T00:00:00.000Z");

function run(store: InMemoryLineupStore, payload: RawLineupPayload) {
  return ingest({
    fetcher: new FixtureLineupFetcher(payload),
    store,
    pageUrl: "https://example.test/line-up",
    festival,
    now: fixedNow,
  });
}

describe("ingest orchestration (fixtures + in-memory store)", () => {
  it("first run imports everything as added and bumps the revision to 1", async () => {
    const store = new InMemoryLineupStore();
    const result = await run(store, buildFixturePayload());

    expect(result.status).toBe("updated");
    expect(result.changesCount).toBe(store.perfs.size);
    expect(result.changesCount).toBeGreaterThan(100);
    expect(result.revision).toBe(1);
    expect(result.festivalId).not.toBe("");
  });

  it("an identical re-run detects no change via the content hash and keeps the revision", async () => {
    const store = new InMemoryLineupStore();
    const payload = buildFixturePayload();
    await run(store, payload);
    const second = await run(store, payload);

    expect(second.status).toBe("no_changes");
    expect(second.changesCount).toBe(0);
    expect([...store.revisions.values()][0]).toBe(1);
  });

  it("a changed payload produces a removed + time_changed diff and bumps the revision to 2", async () => {
    const store = new InMemoryLineupStore();
    await run(store, buildFixturePayload());

    let droppedId = "";
    let changedId = "";
    const mutated = buildFixturePayload({
      weekendTransform: (name, text) => {
        if (name !== "W1") return text;
        const file = JSON.parse(text) as SourceWeekendFile;
        droppedId = file.performances[0]!.id;
        const changed = file.performances[1]!;
        changedId = changed.id;
        changed.endTime = "2027-07-17 23:59:00+02:00"; // clearly different instant
        file.performances.splice(0, 1); // drop one act -> "removed"
        return JSON.stringify(file);
      },
    });
    const third = await run(store, mutated);

    expect(third.status).toBe("updated");
    expect(third.revision).toBe(2);
    expect(third.changesCount).toBeGreaterThanOrEqual(2);
    expect(
      store.changeLog.find((c) => c.changeType === "removed" && c.sourcePerformanceId === droppedId)
    ).toBeDefined();
    expect(
      store.changeLog.find((c) => c.changeType === "time_changed" && c.sourcePerformanceId === changedId)
    ).toBeDefined();
  });
});
