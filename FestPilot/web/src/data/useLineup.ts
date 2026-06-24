/**
 * Loads the active festival + its lineup, served from the shared in-memory cache (R3) so every
 * screen reads the same data without refetching on each mount — tab switches are instant. V1 is
 * single-festival (DEC-038); consumers ask for the full lineup, so they all share one cache entry.
 * Returns the same small state machine the screens already render against.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { LineupQuery } from "./api";
import {
  ensureLineup,
  getLineupSnapshot,
  reloadLineup,
  subscribeLineup,
  type LineupStatus,
} from "./lineupCache";
import type { LineupDto } from "./types";

export type { LineupStatus };

export interface LineupState {
  status: LineupStatus;
  lineup: LineupDto | null;
  error: string | null;
  reload: () => void;
}

export function useLineup(query: LineupQuery = {}): LineupState {
  const weekend = query.weekend;
  const day = query.day;

  const subscribe = useCallback((cb: () => void) => subscribeLineup({ weekend, day }, cb), [weekend, day]);
  const snapshot = useSyncExternalStore(subscribe, () => getLineupSnapshot({ weekend, day }));

  // Kick the fetch (or a background revalidation) once per mount/query — deduped inside the cache.
  useEffect(() => {
    ensureLineup({ weekend, day });
  }, [weekend, day]);

  const reload = useCallback(() => reloadLineup({ weekend, day }), [weekend, day]);

  return { status: snapshot.status, lineup: snapshot.lineup, error: snapshot.error, reload };
}
