/**
 * Squad shared-timetable hook (Gate 4.3). Joins three sources into the aggregated group plan:
 *   1. the squad's RAW shared data from the server (who locked what, shared favorites, overrides),
 *   2. the lineup the client already holds (set times / stages / acts), and
 *   3. the current user's local favorites (for the personal favorites-fallback, DEC-019).
 *
 * The aggregation itself is the pure `buildSquadPlan`. Freshness mirrors `useGroup`: a best-effort
 * GroupRoom socket plus a refetch on focus; the HTTP path alone is always correct.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { useGroupLive } from "./groups";
import { useFavorites } from "./localStore";
import { useLineup } from "./useLineup";
import { toPlannableSets } from "../domain/lineup";
import { buildSquadPlan, type SquadMember, type SquadPlan } from "../domain/squadPlan";
import type { PlannableSet } from "../domain/types";
import type { LoadStatus } from "./groups";
import type { SquadPlanDataDto } from "./types";

export interface SquadPlanState {
  /** The aggregated squad timetable for the day (null until both sources resolve). */
  plan: SquadPlan | null;
  /** Raw shared data (members, overrides) — drives owner-only affordances. */
  raw: SquadPlanDataDto | null;
  /** All plannable sets for the day (for the owner-override act list). */
  daySets: PlannableSet[];
  /** The current user's id within this squad (from the isYou flag). */
  meId: string | null;
  timezone: string;
  status: LoadStatus;
  reload: () => void;
}

/** Raw squad-plan data with the same live + focus refresh contract as `useGroup`. */
function useSquadPlanData(
  groupId: string | undefined,
  day: string | undefined
): { raw: SquadPlanDataDto | null; status: LoadStatus; reload: () => void } {
  const [raw, setRaw] = useState<SquadPlanDataDto | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!groupId || !day) return;
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    api
      .getSquadPlan(groupId, day, controller.signal)
      .then((data) => {
        if (!alive) return;
        setRaw(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive || controller.signal.aborted) return;
        setStatus("error");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [groupId, day, nonce]);

  useEffect(() => {
    if (!groupId) return;
    const onFocus = (): void => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [groupId, reload]);

  useGroupLive(groupId, reload);
  return { raw, status, reload };
}

export function useSquadPlan(groupId: string | undefined, day: string | undefined): SquadPlanState {
  const lineup = useLineup();
  const { raw, status: rawStatus, reload } = useSquadPlanData(groupId, day);
  const festivalId = lineup.lineup?.festival.id;
  const favorites = useFavorites(festivalId);

  const daySets = useMemo<PlannableSet[]>(() => {
    if (!lineup.lineup || !day) return [];
    return toPlannableSets(lineup.lineup.performances, lineup.lineup.stages).filter((s) => s.day === day);
  }, [lineup.lineup, day]);

  const plan = useMemo<SquadPlan | null>(() => {
    if (!raw || !lineup.lineup) return null;
    const members: SquadMember[] = raw.members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      avatarColor: m.avatarColor,
      role: m.role,
      isYou: m.isYou,
      shared: m.shared,
      performanceIds: m.performanceIds,
      favoriteActKeys: m.favoriteActKeys,
    }));
    const meId = raw.members.find((m) => m.isYou)?.userId ?? null;
    return buildSquadPlan({
      sets: daySets,
      members,
      overrides: raw.overrides,
      meId,
      myFavoriteActKeys: favorites.keys,
    });
  }, [raw, lineup.lineup, daySets, favorites.keys]);

  const status: LoadStatus =
    rawStatus === "error" || lineup.status === "error"
      ? "error"
      : raw && lineup.lineup
        ? "ready"
        : "loading";

  return {
    plan,
    raw,
    daySets,
    meId: raw?.members.find((m) => m.isYou)?.userId ?? null,
    timezone: lineup.lineup?.festival.timezone ?? "Europe/Brussels",
    status,
    reload,
  };
}
