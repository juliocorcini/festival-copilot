// R4.4 / DEC-055: "suggest a festival" capture. A suggestion dedupes on a normalized name and bumps
// a count, so the admin inbox can rank demand. No login required (suggestedBy is nullable).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  isSuggestionStatus,
  listFestivalSuggestions,
  normalizeSuggestionName,
  suggestFestival,
  updateSuggestionStatus,
} from "../src/api/festivalSuggestions";
import { createSqliteDb, makeD1 } from "./d1-shim";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrations = ["0001_init.sql", "0009_festival_suggestion.sql"]
  .map((f) => fs.readFileSync(path.join(here, "..", "migrations", f), "utf-8"))
  .join("\n");

async function freshDb(): Promise<D1Database> {
  const db = await createSqliteDb(migrations);
  return makeD1(db);
}

describe("normalizeSuggestionName", () => {
  it("trims, lowercases and collapses internal whitespace", () => {
    expect(normalizeSuggestionName("  Rock   AM  Ring ")).toBe("rock am ring");
    expect(normalizeSuggestionName("Coachella")).toBe("coachella");
  });
});

describe("suggestFestival (DEC-055)", () => {
  it("records a new suggestion with count=1", async () => {
    const db = await freshDb();
    const res = await suggestFestival(db, { name: "Sziget", suggestedBy: null }, "2026-06-24T10:00:00Z");
    expect(res).toEqual({ count: 1, created: true });

    const list = await listFestivalSuggestions(db);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "Sziget", count: 1, status: "new", suggestedBy: null });
  });

  it("dedupes case/whitespace-insensitively and bumps the count instead of duplicating", async () => {
    const db = await freshDb();
    await suggestFestival(db, { name: "Rock am Ring", suggestedBy: "anon:1" }, "2026-06-24T10:00:00Z");
    const second = await suggestFestival(
      db,
      { name: "  rock   AM   ring ", suggestedBy: "anon:2" },
      "2026-06-24T11:00:00Z"
    );
    expect(second).toEqual({ count: 2, created: false });

    const list = await listFestivalSuggestions(db);
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(2);
    // Display name keeps the first spelling; the second only bumps the counter.
    expect(list[0].name).toBe("Rock am Ring");
  });

  it("ranks the inbox by demand (count desc)", async () => {
    const db = await freshDb();
    await suggestFestival(db, { name: "Primavera", suggestedBy: null }, "2026-06-24T10:00:00Z");
    await suggestFestival(db, { name: "Glastonbury", suggestedBy: null }, "2026-06-24T10:01:00Z");
    await suggestFestival(db, { name: "Glastonbury", suggestedBy: null }, "2026-06-24T10:02:00Z");

    const list = await listFestivalSuggestions(db);
    expect(list.map((s) => s.name)).toEqual(["Glastonbury", "Primavera"]);
    expect(list[0].count).toBe(2);
  });

  it("records the optional caller id when present", async () => {
    const db = await freshDb();
    await suggestFestival(db, { name: "Wacken", suggestedBy: "anon:abc" }, "2026-06-24T10:00:00Z");
    const list = await listFestivalSuggestions(db);
    expect(list[0].suggestedBy).toBe("anon:abc");
  });
});

describe("updateSuggestionStatus (R11.3)", () => {
  it("validates the allowed statuses", () => {
    expect(isSuggestionStatus("planned")).toBe(true);
    expect(isSuggestionStatus("live")).toBe(true);
    expect(isSuggestionStatus("garbage")).toBe(false);
    expect(isSuggestionStatus(42)).toBe(false);
  });

  it("moves a suggestion to a new status", async () => {
    const db = await freshDb();
    await suggestFestival(db, { name: "Dekmantel", suggestedBy: null }, "2026-06-24T10:00:00Z");
    const id = (await listFestivalSuggestions(db))[0].id;

    const ok = await updateSuggestionStatus(db, id, "planned", "2026-06-24T12:00:00Z");
    expect(ok).toBe(true);
    expect((await listFestivalSuggestions(db))[0].status).toBe("planned");
  });

  it("returns false for an unknown id", async () => {
    const db = await freshDb();
    expect(await updateSuggestionStatus(db, "missing", "live", "2026-06-24T12:00:00Z")).toBe(false);
  });
});
