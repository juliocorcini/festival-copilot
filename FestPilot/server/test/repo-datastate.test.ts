// R4.1 / DEC-052: the read API must surface which of the 3 data-states a festival is in, so the
// client can default to the right view: nothing-yet / lineup-only / full-timetable. These flags are
// derived from `festival.with_timetable` + the (active, non-placeholder) performance rows.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { getLineup } from "../src/api/repo";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = ["0001_init.sql", "0008_festival_with_timetable.sql", "0014_artist_socials.sql"]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

interface SeedPerf {
  id: string;
  placeholder?: boolean;
  start?: string | null;
  artistId?: string | null;
}

async function seed(withTimetable: number, perfs: SeedPerf[]): Promise<D1Database> {
  const db = await createSqliteDb(migrations);
  db.run(
    `INSERT INTO festival (id, name, slug, timezone, created_at_utc, with_timetable)
     VALUES ('f1','Test Fest','test-fest','Europe/Brussels','2026-06-23T00:00:00Z', ${withTimetable})`
  );
  db.run(`INSERT INTO stage (id, festival_id, source_stage_id, name, sort_order) VALUES ('s1','f1','S1','MAIN',0)`);
  db.run(`INSERT INTO artist (id, source_artist_id, name, image_url) VALUES ('a1','A1','Real Act', NULL)`);
  for (const p of perfs) {
    const start = p.start === undefined ? "'2026-07-17T19:00:00Z'" : p.start === null ? "NULL" : `'${p.start}'`;
    db.run(
      `INSERT INTO performance
         (id, festival_id, stage_id, source_performance_id, name, day, start_at_utc, end_at_utc, is_placeholder, active)
       VALUES ('${p.id}','f1','s1','${p.id}','${p.id}','FRIDAY', ${start}, NULL, ${p.placeholder ? 1 : 0}, 1)`
    );
    const artistId = p.artistId === undefined ? "a1" : p.artistId;
    if (artistId) {
      db.run(
        `INSERT INTO performance_artist (performance_id, artist_id, sort_order) VALUES ('${p.id}','${artistId}',0)`
      );
    }
  }
  return makeD1(db);
}

describe("data-state flags (DEC-052)", () => {
  it("nothing-yet: only placeholders (no real act) → hasLineup=false, hasTimetable=false", async () => {
    const d1 = await seed(0, [{ id: "p1", placeholder: true, artistId: null }]);
    const lineup = await getLineup(d1, "f1");
    expect(lineup!.hasLineup).toBe(false);
    expect(lineup!.hasTimetable).toBe(false);
    expect(lineup!.festival.withTimetable).toBe(false);
  });

  it("lineup-only: real acts but withTimetable=false → hasLineup=true, hasTimetable=false", async () => {
    // Even with rows that carry a start time, withTimetable=false means the schedule isn't published.
    const d1 = await seed(0, [{ id: "p1", artistId: "a1" }]);
    const lineup = await getLineup(d1, "f1");
    expect(lineup!.hasLineup).toBe(true);
    expect(lineup!.hasTimetable).toBe(false);
  });

  it("timetable: withTimetable=true + scheduled real acts → both true", async () => {
    const d1 = await seed(1, [{ id: "p1", artistId: "a1", start: "2026-07-17T19:00:00Z" }]);
    const lineup = await getLineup(d1, "f1");
    expect(lineup!.hasLineup).toBe(true);
    expect(lineup!.hasTimetable).toBe(true);
  });

  it("timetable published but no times yet → hasTimetable=false (lineup-only)", async () => {
    const d1 = await seed(1, [{ id: "p1", artistId: "a1", start: null }]);
    const lineup = await getLineup(d1, "f1");
    expect(lineup!.hasLineup).toBe(true);
    expect(lineup!.hasTimetable).toBe(false);
  });

  it("flags describe the whole festival, not a weekend/day filter slice", async () => {
    const d1 = await seed(1, [{ id: "p1", artistId: "a1", start: "2026-07-17T19:00:00Z" }]);
    // Filter to a day with no rows: performances empty, but the data-state flags still hold.
    const lineup = await getLineup(d1, "f1", { day: "SUNDAY" });
    expect(lineup!.performances.length).toBe(0);
    expect(lineup!.hasLineup).toBe(true);
    expect(lineup!.hasTimetable).toBe(true);
  });
});
