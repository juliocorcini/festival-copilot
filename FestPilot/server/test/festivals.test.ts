// Festival registry + multi-festival ingestion (R11.1c / DEC-063). Pure validators are tested
// directly; the registry reads/writes + onboarding run against the real migration via the D1 shim
// with the fixture lineup fetcher (no network).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  festivalSlugExists,
  ingestAllFestivals,
  isValidTimezone,
  listIngestTargets,
  normalizeSlug,
  onboardFestival,
  readMetaPatch,
  readOnboardInput,
  updateFestivalMeta,
} from "../src/ingest/festivals";
import type { Env } from "../src/env";
import { buildFixturePayload, FixtureLineupFetcher } from "./fixtures";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = ["0001_init.sql", "0008_festival_with_timetable.sql", "0014_artist_socials.sql"]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

async function freshDb(): Promise<D1Database> {
  return makeD1(await createSqliteDb(migrations));
}

const SEED_ENV_VARS = {
  LINEUP_PAGE_URL: "https://belgium.tomorrowland.com/en/line-up/?page=timetable",
  FESTIVAL_NAME: "Tomorrowland Belgium 2026",
  FESTIVAL_SLUG: "tomorrowland-belgium-2026",
  FESTIVAL_TIMEZONE: "Europe/Brussels",
  LINEUP_EVENT: "TL26BE",
  LINEUP_UUID: "uuid-seed",
};

const envWith = (db: D1Database): Env => ({ DB: db, ...SEED_ENV_VARS } as unknown as Env);

const fixtureFetcher = () => new FixtureLineupFetcher(buildFixturePayload());

describe("normalizeSlug", () => {
  it("lowercases, hyphenates spaces, strips junk and trims hyphens", () => {
    expect(normalizeSlug("  Tomorrowland Belgium 2026 ")).toBe("tomorrowland-belgium-2026");
    expect(normalizeSlug("Awakenings — ADE!")).toBe("awakenings-ade");
    expect(normalizeSlug("O'Neill's Fest")).toBe("oneills-fest");
    expect(normalizeSlug("___")).toBe("");
  });
});

describe("isValidTimezone", () => {
  it("accepts IANA names and rejects garbage", () => {
    expect(isValidTimezone("Europe/Brussels")).toBe(true);
    expect(isValidTimezone("America/Sao_Paulo")).toBe(true);
    expect(isValidTimezone("UTC")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
    expect(isValidTimezone("not a tz")).toBe(false);
  });
});

describe("readOnboardInput", () => {
  it("accepts a valid payload and derives the slug from the name when omitted", () => {
    const r = readOnboardInput({
      name: "  Dreamville 2026 ",
      timezone: "Europe/Brussels",
      pageUrl: "https://dreamville.test/line-up",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("Dreamville 2026");
      expect(r.value.slug).toBe("dreamville-2026");
      expect(r.value.event).toBeUndefined();
    }
  });

  it("keeps a provided slug (normalized) and pairs event+uuid", () => {
    const r = readOnboardInput({
      name: "X",
      slug: "Custom Slug",
      timezone: "UTC",
      pageUrl: "https://x.test/l",
      event: " TL26BR ",
      uuid: " abc ",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slug).toBe("custom-slug");
      expect(r.value.event).toBe("TL26BR");
      expect(r.value.uuid).toBe("abc");
    }
  });

  it("rejects missing name, bad timezone, bad url, and a lone event without uuid", () => {
    expect(readOnboardInput({ timezone: "UTC", pageUrl: "https://x.test" }).ok).toBe(false);
    expect(readOnboardInput({ name: "X", timezone: "Nope/Zone", pageUrl: "https://x.test" }).ok).toBe(false);
    expect(readOnboardInput({ name: "X", timezone: "UTC", pageUrl: "ftp://x" }).ok).toBe(false);
    expect(readOnboardInput({ name: "X", timezone: "UTC", pageUrl: "https://x.test", event: "E" }).ok).toBe(false);
  });
});

describe("readMetaPatch", () => {
  it("accepts name-only, timezone-only, or both", () => {
    expect(readMetaPatch({ name: "New" })).toEqual({ ok: true, value: { name: "New" } });
    expect(readMetaPatch({ timezone: "UTC" })).toEqual({ ok: true, value: { timezone: "UTC" } });
    const both = readMetaPatch({ name: " A ", timezone: "Europe/Madrid" });
    expect(both).toEqual({ ok: true, value: { name: "A", timezone: "Europe/Madrid" } });
  });

  it("rejects an empty patch, a blank name, and a bad timezone", () => {
    expect(readMetaPatch({}).ok).toBe(false);
    expect(readMetaPatch({ name: "   " }).ok).toBe(false);
    expect(readMetaPatch({ timezone: "Nope/Zone" }).ok).toBe(false);
  });
});

describe("onboardFestival + registry", () => {
  it("creates the festival, persists its source page, and ingests the lineup", async () => {
    const db = await freshDb();
    expect(await festivalSlugExists(db, "dreamville")).toBe(false);

    const result = await onboardFestival(
      envWith(db),
      { name: "Dreamville", slug: "dreamville", timezone: "Europe/Brussels", pageUrl: "https://dreamville.test/line-up" },
      fixtureFetcher()
    );

    expect(result.status).toBe("updated");
    expect(result.changesCount).toBeGreaterThan(100);
    expect(result.revision).toBe(1);
    expect(await festivalSlugExists(db, "dreamville")).toBe(true);

    const targets = await listIngestTargets(db);
    expect(targets).toHaveLength(1);
    expect(targets[0]!.slug).toBe("dreamville");
    expect(targets[0]!.pageUrl).toBe("https://dreamville.test/line-up");

    const perfCount = await db
      .prepare("SELECT COUNT(*) AS c FROM performance WHERE festival_id = ? AND active = 1")
      .bind(result.festivalId)
      .first<{ c: number }>();
    expect(perfCount!.c).toBeGreaterThan(100);
  });
});

describe("ingestAllFestivals", () => {
  it("bootstraps from the env-var seed when the registry is empty", async () => {
    const db = await freshDb();
    const results = await ingestAllFestivals(envWith(db), fixtureFetcher());
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe("updated");
    expect(await festivalSlugExists(db, "tomorrowland-belgium-2026")).toBe(true);
  });

  it("re-ingests every registered festival once the registry is populated", async () => {
    const db = await freshDb();
    const env = envWith(db);
    await onboardFestival(env, { name: "Fest A", slug: "fest-a", timezone: "UTC", pageUrl: "https://a.test/l" }, fixtureFetcher());
    await onboardFestival(env, { name: "Fest B", slug: "fest-b", timezone: "UTC", pageUrl: "https://b.test/l" }, fixtureFetcher());

    expect(await listIngestTargets(db)).toHaveLength(2);

    // The identical fixture re-run is detected as no-change by the content hash for both.
    const results = await ingestAllFestivals(env, fixtureFetcher());
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === "no_changes")).toBe(true);
  });
});

describe("updateFestivalMeta", () => {
  it("renames + fixes the timezone, and reports a miss for an unknown id", async () => {
    const db = await freshDb();
    const env = envWith(db);
    const { festivalId } = await onboardFestival(
      env,
      { name: "Old Name", slug: "edit-me", timezone: "UTC", pageUrl: "https://e.test/l" },
      fixtureFetcher()
    );

    const ok = await updateFestivalMeta(db, festivalId, { name: "New Name", timezone: "Europe/Madrid" });
    expect(ok).toBe(true);
    const row = await db.prepare("SELECT name, timezone FROM festival WHERE id = ?").bind(festivalId).first<{ name: string; timezone: string }>();
    expect(row).toEqual({ name: "New Name", timezone: "Europe/Madrid" });

    expect(await updateFestivalMeta(db, "does-not-exist", { name: "X" })).toBe(false);
  });
});
