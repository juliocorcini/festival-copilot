import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { describe, expect, it } from "vitest";

import { getFestivalMap, upsertFestivalMap, type FestivalMapInput } from "../src/api/repo";
import type { MapTransformDoc } from "../src/api/dto";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = ["0001_init.sql", "0002_festival_map.sql"]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const transform: MapTransformDoc = {
  festival: "tomorrowland-deschorre",
  venue: "De Schorre",
  canvas: { width: 1000, height: 1291 },
  bbox: { west: 4.3756, east: 4.3897, south: 51.0849, north: 51.0964 },
  affine: { a: 66789.5, b: 0, c: -292218.5, d: 2.79, e: -106339.4, f: 5433593.1 },
  stages: [{ name: "MAINSTAGE", lng: 4.3864793, lat: 51.0921683, matched: true }],
  source: "OpenStreetMap contributors (ODbL)",
};

const input: FestivalMapInput = {
  assetSlug: "tomorrowland-deschorre",
  baseNightKey: "maps/tomorrowland-deschorre.webp",
  baseDayKey: "maps/tomorrowland-deschorre-day.webp",
  transform,
  revision: 1,
};

async function seededDb(): Promise<{ db: Database; d1: D1Database }> {
  const db = await createSqliteDb(migrations);
  db.run(
    `INSERT INTO festival (id, name, slug, timezone, created_at_utc)
     VALUES ('fest_1','Tomorrowland Belgium 2026','tomorrowland-belgium-2026','Europe/Brussels','2026-06-23T00:00:00Z')`
  );
  return { db, d1: makeD1(db) };
}

describe("festival_map registry (DEC-040)", () => {
  it("returns null when a festival has no map row (route maps this to 404)", async () => {
    const { d1 } = await seededDb();
    expect(await getFestivalMap(d1, "fest_1")).toBeNull();
  });

  it("upserts then reads back with client URLs built from keys + a parsed transform", async () => {
    const { d1 } = await seededDb();
    await upsertFestivalMap(d1, "fest_1", input, "2026-06-23T10:00:00Z");
    const map = await getFestivalMap(d1, "fest_1");
    expect(map).not.toBeNull();
    expect(map!.festivalId).toBe("fest_1");
    expect(map!.assetSlug).toBe("tomorrowland-deschorre");
    expect(map!.baseNightUrl).toBe("/maps/tomorrowland-deschorre.webp");
    expect(map!.baseDayUrl).toBe("/maps/tomorrowland-deschorre-day.webp");
    expect(map!.revision).toBe(1);
    // transform round-trips intact (the affine is what the overlay needs).
    expect(map!.transform.affine.a).toBeCloseTo(66789.5);
    expect(map!.transform.stages[0]!.name).toBe("MAINSTAGE");
    expect(map!.transform.canvas.height).toBe(1291);
  });

  it("is idempotent — re-publish updates in place (no duplicate row, revision bumps)", async () => {
    const { db, d1 } = await seededDb();
    await upsertFestivalMap(d1, "fest_1", input, "2026-06-23T10:00:00Z");
    await upsertFestivalMap(d1, "fest_1", { ...input, revision: 2 }, "2026-06-23T11:00:00Z");
    const count = Number(db.exec("SELECT count(*) FROM festival_map")[0]!.values[0]![0]);
    expect(count).toBe(1);
    expect((await getFestivalMap(d1, "fest_1"))!.revision).toBe(2);
  });

  it("passes through absolute URLs unchanged (R2/CDN-ready)", async () => {
    const { d1 } = await seededDb();
    await upsertFestivalMap(
      d1,
      "fest_1",
      { ...input, baseNightKey: "https://cdn.example/x.webp", baseDayKey: "https://cdn.example/x-day.webp" },
      "2026-06-23T10:00:00Z"
    );
    const map = await getFestivalMap(d1, "fest_1");
    expect(map!.baseNightUrl).toBe("https://cdn.example/x.webp");
  });
});
