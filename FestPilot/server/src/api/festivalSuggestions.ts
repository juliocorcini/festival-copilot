// Festival suggestions (DEC-055, R4.4). A user can ask for a festival we don't cover yet — no login,
// no friction. We dedupe on a normalized name and increment a count so the admin inbox (R11) can rank
// demand. Raw access is abstracted here; routes stay thin (software-engineering-guidelines §3.6).

import type { FestivalSuggestionDto } from "./dto";
import { ulid } from "../db/ids";

/** Dedupe key: trim, lowercase, collapse internal whitespace. */
export function normalizeSuggestionName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface SuggestInput {
  name: string;
  /** Optional caller id (anon firebase_uid); null when unauthenticated. */
  suggestedBy: string | null;
}

/** Record a suggestion (or bump an existing one's count). Returns the resulting count + whether new. */
export async function suggestFestival(
  db: D1Database,
  input: SuggestInput,
  nowIso: string
): Promise<{ count: number; created: boolean }> {
  const normalized = normalizeSuggestionName(input.name);
  const before = await db
    .prepare("SELECT count FROM festival_suggestion WHERE name_normalized = ?")
    .bind(normalized)
    .first<{ count: number }>();

  await db
    .prepare(
      `INSERT INTO festival_suggestion
         (id, name, name_normalized, suggested_by, count, status, created_at_utc, updated_at_utc)
       VALUES (?, ?, ?, ?, 1, 'new', ?, ?)
       ON CONFLICT(name_normalized) DO UPDATE SET
         count = count + 1,
         updated_at_utc = excluded.updated_at_utc`
    )
    .bind(ulid(), input.name.trim(), normalized, input.suggestedBy, nowIso, nowIso)
    .run();

  return { count: (before?.count ?? 0) + 1, created: !before };
}

/** The admin inbox view: most-requested first. */
export async function listFestivalSuggestions(db: D1Database): Promise<FestivalSuggestionDto[]> {
  const res = await db
    .prepare(
      `SELECT id, name, count, status, suggested_by, created_at_utc, updated_at_utc
         FROM festival_suggestion
        ORDER BY count DESC, updated_at_utc DESC`
    )
    .all<{
      id: string;
      name: string;
      count: number;
      status: string;
      suggested_by: string | null;
      created_at_utc: string;
      updated_at_utc: string;
    }>();
  return (res.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    count: r.count,
    status: r.status,
    suggestedBy: r.suggested_by,
    createdAtUtc: r.created_at_utc,
    updatedAtUtc: r.updated_at_utc,
  }));
}
