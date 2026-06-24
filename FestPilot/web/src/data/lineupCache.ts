/**
 * Shared lineup cache (R3 — review §18.1). The festival + lineup are fetched ONCE and served from
 * memory across every screen (Now / Timetable / My Plan / Lineup / Onboarding / Map / Squad), so
 * switching tabs is instant instead of refetching + reparsing the whole lineup each mount (~3 s).
 *
 * It's a tiny stale-while-revalidate store keyed by the (weekend, day) query — in V1 every consumer
 * asks for the full lineup (no filter), so there's effectively one entry. The service worker's
 * network-first `/api` cache remains the offline layer; this only removes the redundant in-session
 * fetch/parse. Concurrent mounts share the single in-flight request; a stale entry refreshes in the
 * background without dropping the data already on screen.
 */
import { api, ApiError, type LineupQuery } from "./api";
import type { LineupDto } from "./types";

export type LineupStatus = "loading" | "ready" | "error";

export interface LineupSnapshot {
  status: LineupStatus;
  lineup: LineupDto | null;
  error: string | null;
}

interface Entry {
  /** Stable reference — only replaced when something actually changes (so getSnapshot is cache-safe). */
  snapshot: LineupSnapshot;
  promise: Promise<void> | null;
  fetchedAt: number;
  subs: Set<() => void>;
}

/** Serve from memory, then refresh in the background once the data is older than this. */
const REVALIDATE_MS = 5 * 60_000;
const LOADING: LineupSnapshot = { status: "loading", lineup: null, error: null };

const cache = new Map<string, Entry>();

const keyOf = (q: LineupQuery): string => `${q.weekend ?? ""}|${q.day ?? ""}`;

function entryFor(key: string): Entry {
  let e = cache.get(key);
  if (!e) {
    e = { snapshot: LOADING, promise: null, fetchedAt: 0, subs: new Set() };
    cache.set(key, e);
  }
  return e;
}

function emit(e: Entry, next: LineupSnapshot): void {
  e.snapshot = next;
  for (const fn of e.subs) fn();
}

function fetchInto(e: Entry, query: LineupQuery): void {
  // Keep any data already on screen while revalidating; only show the skeleton on a true cold load.
  if (e.snapshot.status !== "ready") emit(e, { status: "loading", lineup: e.snapshot.lineup, error: null });

  e.promise = (async () => {
    try {
      const festivals = await api.listFestivals();
      const festival = festivals[0];
      if (!festival) throw new ApiError("No festival published yet", 404, "/api/festivals");
      const lineup = await api.getLineup(festival.id, { weekend: query.weekend, day: query.day });
      e.fetchedAt = Date.now();
      emit(e, { status: "ready", lineup, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // A failed revalidation must not wipe good data — keep serving the stale lineup, surface error only cold.
      if (e.snapshot.lineup) emit(e, { status: "ready", lineup: e.snapshot.lineup, error: message });
      else emit(e, { status: "error", lineup: null, error: message });
    } finally {
      e.promise = null;
    }
  })();
}

/** Kick a fetch if needed: cold entries load; ready-but-stale entries refresh in the background. */
export function ensureLineup(query: LineupQuery): void {
  const e = entryFor(keyOf(query));
  if (e.promise) return; // a request is already in flight — share it
  const stale = Date.now() - e.fetchedAt > REVALIDATE_MS;
  if (e.snapshot.status !== "ready" || stale) fetchInto(e, query);
}

/** Force a refetch (the screens' "reload" / retry control). */
export function reloadLineup(query: LineupQuery): void {
  const e = entryFor(keyOf(query));
  if (!e.promise) fetchInto(e, query);
}

export function subscribeLineup(query: LineupQuery, cb: () => void): () => void {
  const e = entryFor(keyOf(query));
  e.subs.add(cb);
  return () => {
    e.subs.delete(cb);
  };
}

export function getLineupSnapshot(query: LineupQuery): LineupSnapshot {
  return entryFor(keyOf(query)).snapshot;
}

/** Test-only: drop all cached entries so each test starts cold. */
export function __resetLineupCache(): void {
  cache.clear();
}
