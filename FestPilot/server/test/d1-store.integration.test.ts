import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Database } from "sql.js";
import { beforeAll, describe, expect, it } from "vitest";

import { getLineup, listFestivals } from "../src/api/repo";
import { ingest } from "../src/ingest/ingest";
import { D1LineupStore } from "../src/ingest/store";
import type { SourceWeekendFile } from "../src/lineup/types";
import { buildFixturePayload, FixtureLineupFetcher } from "./fixtures";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaSql = ["0001_init.sql", "0008_festival_with_timetable.sql"]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

const festival = {
  name: "Tomorrowland Belgium 2026",
  slug: "tomorrowland-belgium-2026",
  timezone: "Europe/Brussels",
};
const fixedNow = () => new Date("2026-06-23T00:00:00.000Z");

// Deterministic id factory (unique across the whole file).
let counter = 0;
const ids = () => `id_${(++counter).toString().padStart(10, "0")}`;

function ingestFixture(store: D1LineupStore, transform?: (n: string, t: string) => string) {
  const payload = transform
    ? buildFixturePayload({ weekendTransform: transform })
    : buildFixturePayload();
  return ingest({
    fetcher: new FixtureLineupFetcher(payload),
    store,
    pageUrl: "https://example.test/line-up",
    festival,
    now: fixedNow,
  });
}

function count(db: Database, sql: string): number {
  const res = db.exec(sql);
  return Number(res[0]!.values[0]![0]);
}

describe("D1 integration (real migration applied via sql.js)", () => {
  beforeAll(async () => {
    // Warm the WASM engine once so the first test's timing is representative.
    await createSqliteDb(schemaSql).then((db) => db.close());
  });

  it("applies the migration and creates the full schema", async () => {
    const db = await createSqliteDb(schemaSql);
    const names = (db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]?.values ?? []).map(
      (r) => String(r[0])
    );
    expect(names).toContain("festival");
    expect(names).toContain("performance");
    expect(names).toContain("performance_artist");
    expect(names).toContain("lineup_revision");
    expect(names).toContain("app_group"); // reserved-word table
    expect(names.length).toBeGreaterThanOrEqual(25);
    db.close();
  });

  it("ingests the real lineup with correct UTC instants and serves it via the read API", async () => {
    const db = await createSqliteDb(schemaSql);
    const store = new D1LineupStore(makeD1(db), ids);

    const run1 = await ingestFixture(store);
    expect(run1.status).toBe("updated");
    expect(run1.revision).toBe(1);

    const active = count(db, "SELECT count(*) FROM performance WHERE active = 1");
    expect(active).toBeGreaterThan(100);

    // Every stored instant is UTC and equals the parsed source instant.
    const rows = db.exec("SELECT start_at_utc, raw_start_time FROM performance WHERE active = 1")[0]!;
    for (const [startUtc, rawStart] of rows.values) {
      expect(String(startUtc)).toMatch(/Z$/);
      expect(new Date(String(rawStart).replace(" ", "T")).toISOString()).toBe(String(startUtc));
    }

    // +1s end-time quirk is stripped: no end instant has non-zero seconds.
    expect(count(db, "SELECT count(*) FROM performance WHERE active = 1 AND substr(end_at_utc, 18, 2) != '00'")).toBe(0);

    // Read API serves what we ingested.
    const festivals = await listFestivals(makeD1(db));
    expect(festivals[0]!.revision).toBe(1);
    // Data-state (DEC-052): the TL fixture has withTimetable=true + scheduled real acts.
    expect(festivals[0]!.withTimetable).toBe(true);
    const lineup = await getLineup(makeD1(db), run1.festivalId);
    expect(lineup!.performances.length).toBe(active);
    expect(lineup!.stages.length).toBeGreaterThan(5);
    expect(lineup!.performances.some((p) => p.artists.length > 0)).toBe(true);
    expect(lineup!.hasLineup).toBe(true);
    expect(lineup!.hasTimetable).toBe(true);

    // Idempotent re-run of the identical payload changes nothing.
    const run2 = await ingestFixture(store);
    expect(run2.status).toBe("no_changes");
    expect(count(db, "SELECT revision FROM lineup_revision")).toBe(1);
    db.close();
  });

  it("stores and serves artist photos from artists[].image, leaving photoless artists null (DEC-061)", async () => {
    const db = await createSqliteDb(schemaSql);
    const store = new D1LineupStore(makeD1(db), ids);
    const PHOTO = "https://cdn.test/artist-photo.jpg";

    // The captured spike fixtures predate the artists[].image field. Inject a photo onto one real
    // artist (every W1 occurrence, so first-seen dedup keeps it) to prove the full pipeline carries it.
    let targetId = "";
    const run = await ingest({
      fetcher: new FixtureLineupFetcher(
        buildFixturePayload({
          weekendTransform: (name, text) => {
            if (name !== "W1") return text;
            const file = JSON.parse(text) as SourceWeekendFile;
            const realArtist = file.performances
              .flatMap((p) => p.artists)
              .find((a) => a && !/more to be announced/i.test(a.name));
            targetId = realArtist!.id;
            for (const p of file.performances) {
              for (const a of p.artists) if (a.id === targetId) a.image = PHOTO;
            }
            return JSON.stringify(file);
          },
        })
      ),
      store,
      pageUrl: "https://example.test/line-up",
      festival,
      now: fixedNow,
    });
    expect(run.status).toBe("updated");

    const d1 = makeD1(db);
    const stored = await d1
      .prepare("SELECT image_url FROM artist WHERE source_artist_id = ?")
      .bind(targetId)
      .first<{ image_url: string | null }>();
    expect(stored!.image_url).toBe(PHOTO);

    // Photoless artists are NOT fabricated — they stay null.
    expect(count(db, "SELECT count(*) FROM artist WHERE image_url IS NULL")).toBeGreaterThan(0);

    // The read API serves the photo as imageUrl on the act.
    const lineup = await getLineup(d1, run.festivalId);
    const withPhoto = lineup!.performances.flatMap((p) => p.artists).filter((a) => a.imageUrl === PHOTO);
    expect(withPhoto.length).toBeGreaterThan(0);
    expect(lineup!.performances.flatMap((p) => p.artists).some((a) => a.imageUrl === null)).toBe(true);
    db.close();
  });

  it("marks removed acts inactive, logs changes, and bumps the revision on a real diff", async () => {
    const db = await createSqliteDb(schemaSql);
    const store = new D1LineupStore(makeD1(db), ids);

    await ingestFixture(store);
    const before = count(db, "SELECT count(*) FROM performance WHERE active = 1");

    const run3 = await ingestFixture(store, (name, text) => {
      if (name !== "W1") return text;
      const file = JSON.parse(text) as SourceWeekendFile;
      file.performances.splice(0, 1); // drop one act -> should become inactive
      return JSON.stringify(file);
    });

    expect(run3.status).toBe("updated");
    expect(run3.revision).toBe(2);
    expect(count(db, "SELECT count(*) FROM performance WHERE active = 1")).toBe(before - 1);
    expect(count(db, "SELECT count(*) FROM performance WHERE active = 0")).toBe(1);
    expect(count(db, "SELECT count(*) FROM lineup_change")).toBeGreaterThanOrEqual(1);
    db.close();
  });
});
