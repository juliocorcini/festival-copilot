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
import { api, slotToShareInput } from "./api";
import { useGroupLive } from "./groups";
import { loadStore, useFavorites, useOnboarding, usePlan } from "./localStore";
import { useLineup } from "./useLineup";
import { daysForWeekends } from "../lib/festival";
import { useLocale } from "../i18n";
import { toPlannableSets } from "../domain/lineup";
import { buildSquadPlan, type SquadMember, type SquadPlan } from "../domain/squadPlan";
import type { PlannableSet } from "../domain/types";
import type { LoadStatus } from "./groups";
import type { SquadPlanChangeDto, SquadPlanDataDto } from "./types";

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

/**
 * The festival day the user is "in" right now — the latest day that has already started, else the
 * first. Mirrors the home hero's day selection so the squad's "Next up" reads the SAME day the user
 * is living. Ticks coarsely (a day boundary is rare) to stay correct past midnight.
 */
export function useActiveDayKey(): string | undefined {
  const { lineup } = useLineup();
  const { onboarding } = useOnboarding();
  const locale = useLocale();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  return useMemo(() => {
    if (!lineup) return undefined;
    const days = daysForWeekends(lineup, weekendIds, locale);
    if (days.length === 0) return undefined;
    let chosen = days[0]!;
    for (const day of days) {
      if (day.startMs <= now) chosen = day;
      else break;
    }
    return chosen.key;
  }, [lineup, weekendIds, locale, now]);
}

export interface SquadNextUp {
  /** Today's aggregated squad-plan winners, in the shape the "Next up" card consumes (E04). */
  sets: { label: string; stageName: string; startMs: number; endMs: number }[];
  /** Whether the squad already has a usable aggregated plan — drives the CTA copy (E05 · DEC-093). */
  hasPlan: boolean;
}

/**
 * Feeds the squad-home "Next up" card the SETS the squad is actually doing today (E04 · DEC-092) and
 * tells the plan CTA whether a plan exists (E05 · DEC-093). Read-only: it reuses the aggregated
 * `useSquadPlan` winners and never mixes them back into the aggregation.
 */
export function useSquadNextUp(groupId: string | undefined): SquadNextUp {
  const dayKey = useActiveDayKey();
  const { plan } = useSquadPlan(groupId, dayKey);
  return useMemo(
    () => ({
      sets: (plan?.blocks ?? []).map((b) => ({
        label: b.set.label,
        stageName: b.set.stageName,
        startMs: b.set.startMs,
        endMs: b.set.endMs,
      })),
      hasPlan: plan?.enoughToBuild ?? false,
    }),
    [plan]
  );
}

// ── Live re-share + plan-change history (Gate G4, E07 — DEC-095) ────────────────────────────────

export interface SquadPlanHistoryState {
  changes: SquadPlanChangeDto[];
  status: LoadStatus;
  reload: () => void;
}

/** The squad's plan-change history with the same live + focus refresh contract as `useSquadPlan`. */
export function useSquadPlanHistory(groupId: string | undefined): SquadPlanHistoryState {
  const [changes, setChanges] = useState<SquadPlanChangeDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    api
      .getSquadPlanHistory(groupId, controller.signal)
      .then((list) => {
        if (!alive) return;
        setChanges(list);
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
  }, [groupId, nonce]);

  useGroupLive(groupId, reload);
  return { changes, status, reload };
}

/** Debounce window for the live re-publish — long enough to absorb a burst of edits, short enough to feel instant. */
const LIVE_SYNC_DEBOUNCE_MS = 2500;
// Module-scoped so multiple mounts of `useLivePlanSync` for the same (group, day) share ONE timer /
// in-flight guard — no duplicate PUTs, no loops (after a publish the server matches and the diff is 0).
const liveSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const liveSyncInFlight = new Set<string>();

/** Sorted, de-duplicated join — a stable identity for "is this the same set of ids?". */
function idSetKey(ids: readonly string[]): string {
  return [...new Set(ids)].sort().join(",");
}

/**
 * Live re-share (E07 · DEC-095): once you have shared, your locked plan for the active day stays in
 * step with the squad automatically. When your local picks (or opted-in favorites) drift from what
 * the server holds, this debounces a single re-publish. Idempotent by content (no diff → no call),
 * guarded against duplicate mounts, and a no-op until you have shared at least once (privacy: sharing
 * is always opt-in). The aggregation is untouched — this only re-publishes YOUR picks.
 */
export function useLivePlanSync(groupId: string | undefined): void {
  const dayKey = useActiveDayKey();
  const lineup = useLineup();
  const festivalId = lineup.lineup?.festival.id;
  const { plan: localPlan } = usePlan(festivalId, dayKey);
  const favorites = useFavorites(festivalId);
  const { raw, reload } = useSquadPlanData(groupId, dayKey);

  const me = raw?.members.find((m) => m.isYou) ?? null;
  const meShared = me?.shared ?? false;
  const meShareFav = me?.shareFavorites ?? false;
  const serverIdsKey = idSetKey(me?.performanceIds ?? []);
  const serverFavKey = idSetKey(me?.favoriteActKeys ?? []);
  const localIdsKey = idSetKey((localPlan?.slots ?? []).map((s) => s.setId));
  const localFavKey = idSetKey([...favorites.keys]);

  useEffect(() => {
    if (!groupId || !dayKey || !festivalId || !meShared) return;
    const picksChanged = localIdsKey !== serverIdsKey;
    const favsChanged = meShareFav && localFavKey !== serverFavKey;
    if (!picksChanged && !favsChanged) return;

    const key = `${groupId}:${dayKey}`;
    const pending = liveSyncTimers.get(key);
    if (pending) clearTimeout(pending);
    const timer = setTimeout(() => {
      liveSyncTimers.delete(key);
      if (liveSyncInFlight.has(key)) return;
      liveSyncInFlight.add(key);
      const slots = (loadStore().plans[`${festivalId}:${dayKey}`]?.slots ?? []).map(slotToShareInput);
      api
        .shareMyPlan(groupId, {
          day: dayKey,
          slots,
          shareFavorites: meShareFav,
          favoriteActKeys: meShareFav ? [...favorites.keys] : [],
        })
        .then(() => reload())
        .catch(() => undefined)
        .finally(() => liveSyncInFlight.delete(key));
    }, LIVE_SYNC_DEBOUNCE_MS);
    liveSyncTimers.set(key, timer);

    return () => {
      const t = liveSyncTimers.get(key);
      if (t) {
        clearTimeout(t);
        liveSyncTimers.delete(key);
      }
    };
  }, [groupId, dayKey, festivalId, meShared, meShareFav, localIdsKey, serverIdsKey, localFavKey, serverFavKey, favorites.keys, reload]);
}

// Module-scoped guard so bulk sync runs at most once per group per app lifecycle.
const bulkSyncDone = new Set<string>();

/**
 * Bulk plan sync (F03 / DEC-111): when a user has ALREADY shared at least one day with this squad
 * (opt-in established), automatically share ALL other days that have a local locked plan but haven't
 * been shared to the server yet. Runs ONCE per group mount. Respects privacy: does nothing if the
 * user never shared any day (meShared check comes from the server for the active day — as a proxy
 * we fetch the active-day raw and check; if shared, bulk-sync the rest).
 */
export function useBulkPlanSync(groupId: string | undefined): void {
  const lineup = useLineup();
  const { onboarding } = useOnboarding();
  const festivalId = lineup.lineup?.festival.id;
  const locale = useLocale();
  const favorites = useFavorites(festivalId);
  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const allDays = useMemo(
    () => (lineup.lineup ? daysForWeekends(lineup.lineup, weekendIds, locale) : []),
    [lineup.lineup, weekendIds, locale]
  );

  useEffect(() => {
    if (!groupId || !festivalId || allDays.length === 0) return;
    if (bulkSyncDone.has(groupId)) return;
    bulkSyncDone.add(groupId);

    const store = loadStore();
    const prefix = `${festivalId}:`;
    const localDaysWithPlan = allDays.filter((d) => {
      const key = `${prefix}${d.key}`;
      const p = store.plans[key];
      return p && p.slots.length > 0;
    });
    if (localDaysWithPlan.length === 0) return;

    const favKeys = [...favorites.keys];

    (async () => {
      for (const day of localDaysWithPlan) {
        try {
          const serverRaw = await api.getSquadPlan(groupId, day.key);
          const me = serverRaw?.members.find((m: { isYou: boolean }) => m.isYou);
          if (!me) continue;

          if (!me.shared) {
            const anyDayShared = await hasAnyDayShared(groupId, localDaysWithPlan, allDays);
            if (!anyDayShared) return;
          }

          const localSlots = store.plans[`${prefix}${day.key}`]?.slots ?? [];
          const localIds = idSetKey(localSlots.map((s) => s.setId));
          const serverIds = idSetKey(me.performanceIds ?? []);
          if (localIds === serverIds) continue;

          const slots = localSlots.map(slotToShareInput);
          await api.shareMyPlan(groupId, {
            day: day.key,
            slots,
            shareFavorites: me.shareFavorites ?? false,
            favoriteActKeys: me.shareFavorites ? favKeys : [],
          });
        } catch {
          // Non-critical: the per-day live sync will eventually catch up.
        }
      }
    })();
  }, [groupId, festivalId, allDays, favorites.keys]);
}

async function hasAnyDayShared(
  groupId: string,
  localDays: { key: string }[],
  _allDays: { key: string }[]
): Promise<boolean> {
  for (const day of localDays) {
    try {
      const raw = await api.getSquadPlan(groupId, day.key);
      const me = raw?.members.find((m: { isYou: boolean }) => m.isYou);
      if (me?.shared) return true;
    } catch { /* skip */ }
  }
  return false;
}

export interface SquadPlanNotice {
  /** Unseen changes by OTHER members (drives the badge count). */
  count: number;
  /** The newest unseen change by someone else, for the one-line notice (null when nothing new). */
  latest: SquadPlanChangeDto | null;
  changes: SquadPlanChangeDto[];
  status: LoadStatus;
  reload: () => void;
  /** Mark the current history as seen (clears the badge) — call when the user opens the history. */
  markSeen: () => void;
}

const PLAN_SEEN_PREFIX = "fp.planSeen.";

function readSeen(groupId: string): string {
  try {
    return localStorage.getItem(PLAN_SEEN_PREFIX + groupId) ?? "";
  } catch {
    return "";
  }
}

function writeSeen(groupId: string, iso: string): void {
  try {
    localStorage.setItem(PLAN_SEEN_PREFIX + groupId, iso);
  } catch {
    /* storage unavailable — the badge just won't persist */
  }
}

/**
 * Derives the "what changed while you were away" notice (E07): the unseen changes by OTHER members
 * since the last time the user opened the history. The seen-marker lives in localStorage (offline-
 * friendly, no extra server table). Your own edits never raise the badge.
 */
export function useSquadPlanNotice(groupId: string | undefined): SquadPlanNotice {
  const { changes, status, reload } = useSquadPlanHistory(groupId);
  const [seenAt, setSeenAt] = useState<string>(() => (groupId ? readSeen(groupId) : ""));

  useEffect(() => {
    setSeenAt(groupId ? readSeen(groupId) : "");
  }, [groupId]);

  const unseen = useMemo(
    () => changes.filter((c) => !c.isMine && (seenAt === "" || c.updatedAtUtc > seenAt)),
    [changes, seenAt]
  );

  const markSeen = useCallback(() => {
    if (!groupId) return;
    const newest = changes[0]?.updatedAtUtc ?? new Date().toISOString();
    writeSeen(groupId, newest);
    setSeenAt(newest);
  }, [changes, groupId]);

  return { count: unseen.length, latest: unseen[0] ?? null, changes, status, reload, markSeen };
}
