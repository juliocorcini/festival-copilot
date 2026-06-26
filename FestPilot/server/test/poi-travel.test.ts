import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";

import { listPois, readPoiInputs, replacePois } from "../src/api/poiRepo";
import { listTravelTimes, readTravelTimeInputs, replaceTravelTimes } from "../src/api/travelTimeRepo";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = fs.readFileSync(path.join(here, "..", "migrations", "0001_init.sql"), "utf-8");

// A deterministic id factory so inserted ids are stable + assertable in tests.
function seqIds(): () => string {
  let n = 0;
  return () => `id_${++n}`;
}

async function seededDb(): Promise<{ db: Database; d1: D1Database }> {
  const db = await createSqliteDb(migrations);
  db.run(
    `INSERT INTO festival (id, name, slug, timezone, created_at_utc)
     VALUES ('fest_1','Tomorrowland Belgium 2026','tomorrowland-belgium-2026','Europe/Brussels','2026-06-23T00:00:00Z')`
  );
  // Two stages so the travel matrix has a real directed pair to store.
  db.run(
    `INSERT INTO stage (id, festival_id, source_stage_id, name, sort_order)
     VALUES ('stage_main','fest_1','s1','MAINSTAGE',1), ('stage_core','fest_1','s2','CORE',2)`
  );
  return { db, d1: makeD1(db) };
}

describe("POI registry (DEC-065)", () => {
  it("returns an empty array when a festival has no POIs", async () => {
    const { d1 } = await seededDb();
    expect(await listPois(d1, "fest_1")).toEqual([]);
  });

  it("replaces the whole set then reads back DTOs (verified coerced to boolean)", async () => {
    const { d1 } = await seededDb();
    const stored = await replacePois(
      d1,
      "fest_1",
      [
        { type: "toilet", name: "North loos", lng: 4.386, lat: 51.092, verified: true },
        { type: "water", name: null, lng: 4.387, lat: 51.093, verified: false },
      ],
      seqIds()
    );
    expect(stored).toBe(2);

    const pois = await listPois(d1, "fest_1");
    expect(pois).toHaveLength(2);
    // Ordered by (type, name): "toilet" > "water" alphabetically, so water comes first.
    const water = pois.find((p) => p.type === "water")!;
    const toilet = pois.find((p) => p.type === "toilet")!;
    expect(water.name).toBeNull();
    expect(water.verified).toBe(false);
    expect(toilet.name).toBe("North loos");
    expect(toilet.verified).toBe(true);
    expect(toilet.lng).toBeCloseTo(4.386);
    expect(toilet.lat).toBeCloseTo(51.092);
  });

  it("replace is a full swap — a later save with fewer items drops the rest", async () => {
    const { d1 } = await seededDb();
    await replacePois(
      d1,
      "fest_1",
      [
        { type: "toilet", name: "A", lng: 4.1, lat: 51.1, verified: false },
        { type: "food", name: "B", lng: 4.2, lat: 51.2, verified: false },
      ],
      seqIds()
    );
    await replacePois(d1, "fest_1", [{ type: "medical", name: "First aid", lng: 4.3, lat: 51.3, verified: true }], seqIds());
    const pois = await listPois(d1, "fest_1");
    expect(pois).toHaveLength(1);
    expect(pois[0]!.type).toBe("medical");
  });

  it("does not leak across festivals (festival_id scoping)", async () => {
    const { db, d1 } = await seededDb();
    db.run(
      `INSERT INTO festival (id, name, slug, timezone, created_at_utc)
       VALUES ('fest_2','Other','other','UTC','2026-06-23T00:00:00Z')`
    );
    await replacePois(d1, "fest_1", [{ type: "exit", name: "Gate 1", lng: 4, lat: 51, verified: false }], seqIds());
    expect(await listPois(d1, "fest_2")).toEqual([]);
    expect(await listPois(d1, "fest_1")).toHaveLength(1);
  });

  describe("readPoiInputs validation", () => {
    it("drops entries with an unknown type or non-finite coords; trims + caps the name", async () => {
      const longName = "x".repeat(200);
      const inputs = readPoiInputs({
        pois: [
          { type: "toilet", lng: 4.1, lat: 51.1 }, // ok, name defaults null
          { type: "spaceship", lng: 4, lat: 51 }, // bad type → dropped
          { type: "water", lng: "nope", lat: 51 }, // bad lng → dropped
          { type: "food", lng: 4, lat: 51, name: `  ${longName}  `, verified: true },
        ],
      });
      expect(inputs).toHaveLength(2);
      expect(inputs[0]).toMatchObject({ type: "toilet", name: null, verified: false });
      expect(inputs[1]!.name).toHaveLength(80); // capped
      expect(inputs[1]!.verified).toBe(true);
    });

    it("returns [] for a malformed body", () => {
      expect(readPoiInputs(null)).toEqual([]);
      expect(readPoiInputs({})).toEqual([]);
      expect(readPoiInputs({ pois: "nope" })).toEqual([]);
    });
  });
});

describe("travel-time matrix (DEC-065)", () => {
  it("returns an empty array when no pairs are stored", async () => {
    const { d1 } = await seededDb();
    expect(await listTravelTimes(d1, "fest_1")).toEqual([]);
  });

  it("replaces the matrix then reads back the directed pair with crowded null preserved", async () => {
    const { d1 } = await seededDb();
    const stored = await replaceTravelTimes(
      d1,
      "fest_1",
      [
        { fromStageId: "stage_main", toStageId: "stage_core", minutesTypical: 9, minutesCrowded: 14 },
        { fromStageId: "stage_core", toStageId: "stage_main", minutesTypical: 9, minutesCrowded: null },
      ],
      seqIds()
    );
    expect(stored).toBe(2);

    const times = await listTravelTimes(d1, "fest_1");
    expect(times).toHaveLength(2);
    const forward = times.find((t) => t.fromStageId === "stage_main")!;
    expect(forward.toStageId).toBe("stage_core");
    expect(forward.minutesTypical).toBe(9);
    expect(forward.minutesCrowded).toBe(14);
    const back = times.find((t) => t.fromStageId === "stage_core")!;
    expect(back.minutesCrowded).toBeNull();
  });

  it("re-save replaces in place — the unique (from,to) index never clashes", async () => {
    const { db, d1 } = await seededDb();
    await replaceTravelTimes(
      d1,
      "fest_1",
      [{ fromStageId: "stage_main", toStageId: "stage_core", minutesTypical: 9, minutesCrowded: null }],
      seqIds()
    );
    await replaceTravelTimes(
      d1,
      "fest_1",
      [{ fromStageId: "stage_main", toStageId: "stage_core", minutesTypical: 12, minutesCrowded: 20 }],
      seqIds()
    );
    const count = Number(db.exec("SELECT count(*) FROM stage_travel_time")[0]!.values[0]![0]);
    expect(count).toBe(1);
    const times = await listTravelTimes(d1, "fest_1");
    expect(times[0]!.minutesTypical).toBe(12);
    expect(times[0]!.minutesCrowded).toBe(20);
  });

  describe("readTravelTimeInputs validation", () => {
    it("drops self-pairs, out-of-range + non-numeric minutes; rounds; nulls bad crowded", () => {
      const inputs = readTravelTimeInputs({
        times: [
          { fromStageId: "a", toStageId: "a", minutesTypical: 5 }, // self → dropped
          { fromStageId: "a", toStageId: "b", minutesTypical: 9.6 }, // rounds to 10
          { fromStageId: "a", toStageId: "c", minutesTypical: 9999 }, // over max → dropped
          { fromStageId: "a", toStageId: "d", minutesTypical: 7, minutesCrowded: "junk" }, // crowded → null
        ],
      });
      expect(inputs).toHaveLength(2);
      const ab = inputs.find((t) => t.toStageId === "b")!;
      expect(ab.minutesTypical).toBe(10);
      const ad = inputs.find((t) => t.toStageId === "d")!;
      expect(ad.minutesCrowded).toBeNull();
    });

    it("dedupes by directed pair — the last write for (from,to) wins", () => {
      const inputs = readTravelTimeInputs({
        times: [
          { fromStageId: "a", toStageId: "b", minutesTypical: 5 },
          { fromStageId: "a", toStageId: "b", minutesTypical: 11 },
        ],
      });
      expect(inputs).toHaveLength(1);
      expect(inputs[0]!.minutesTypical).toBe(11);
    });

    it("returns [] for a malformed body", () => {
      expect(readTravelTimeInputs(null)).toEqual([]);
      expect(readTravelTimeInputs({ times: 5 })).toEqual([]);
    });
  });
});
