/**
 * Local-first persistence for onboarding, favorites and the locked plan (DEC-041).
 *
 * Pre-auth (no server identity per DEC-038/024) the user's selections live on-device in a single
 * versioned localStorage object. Pure reducers below are framework-free and unit-tested; the React
 * hooks are thin wrappers that re-read on a cross-component sync event. When auth lands (Phase 4)
 * the anonymous uid adopts this store — no data loss.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlanSlot } from "../domain/types";

export const STORE_KEY = "fp.store.v1";
const STORE_EVENT = "fp:store";
const VERSION = 1 as const;

export interface OnboardingState {
  festivalId: string;
  weekendIds: string[];
  dayKeys: string[];
  completed: boolean;
  /**
   * Unique act keys the user has already seen (captured at onboarding, refreshed on each "revisit"
   * acknowledgement). Drives the R4.3 lineup-update prompt. Optional: absent = no baseline yet, so a
   * pre-feature or skipped onboarding never triggers a false prompt.
   */
  seenActKeys?: string[];
}

export interface PersistedPlan {
  slots: PlanSlot[];
  lockedAt: number;
}

/**
 * Lightweight identity captured at first run (DEC-060): name (required) + email (optional). Lives
 * on-device so the squad name and a future real sign-in prefill from it; the server copy (for admin
 * metrics) is sent separately via `/api/me`.
 */
export interface ProfileState {
  name: string;
  email?: string;
}

export interface StoreShape {
  v: typeof VERSION;
  profile: ProfileState | null;
  onboarding: OnboardingState | null;
  favorites: Record<string, string[]>;
  plans: Record<string, PersistedPlan>;
}

export const EMPTY_STORE: StoreShape = { v: VERSION, profile: null, onboarding: null, favorites: {}, plans: {} };

export function planKey(festivalId: string, dayKey: string): string {
  return `${festivalId}:${dayKey}`;
}

// ── Pure reducers (no DOM) ──────────────────────────────────────────────────

export function favoritesOf(store: StoreShape, festivalId: string): string[] {
  return store.favorites[festivalId] ?? [];
}

export function toggleFavorite(store: StoreShape, festivalId: string, actKey: string): StoreShape {
  const current = new Set(favoritesOf(store, festivalId));
  if (current.has(actKey)) current.delete(actKey);
  else current.add(actKey);
  return { ...store, favorites: { ...store.favorites, [festivalId]: [...current] } };
}

export function clearFavorites(store: StoreShape, festivalId: string): StoreShape {
  return { ...store, favorites: { ...store.favorites, [festivalId]: [] } };
}

export function setOnboarding(store: StoreShape, onboarding: OnboardingState | null): StoreShape {
  return { ...store, onboarding };
}

/** Persist the local identity (DEC-060). Name is trimmed; an empty email is dropped (optional). */
export function setProfile(store: StoreShape, profile: ProfileState): StoreShape {
  const name = profile.name.trim();
  const email = profile.email?.trim();
  return { ...store, profile: { name, ...(email ? { email } : {}) } };
}

/** Mark the current lineup as "seen" (R4.3) so the revisit-favorites prompt clears until acts change. */
export function acknowledgeLineup(store: StoreShape, actKeys: string[]): StoreShape {
  if (!store.onboarding) return store;
  return { ...store, onboarding: { ...store.onboarding, seenActKeys: actKeys } };
}

export function setPlan(store: StoreShape, festivalId: string, dayKey: string, slots: PlanSlot[]): StoreShape {
  const key = planKey(festivalId, dayKey);
  return { ...store, plans: { ...store.plans, [key]: { slots, lockedAt: Date.now() } } };
}

export function clearPlan(store: StoreShape, festivalId: string, dayKey: string): StoreShape {
  const key = planKey(festivalId, dayKey);
  const { [key]: _removed, ...rest } = store.plans;
  return { ...store, plans: rest };
}

// ── Persistence ─────────────────────────────────────────────────────────────

export function loadStore(): StoreShape {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    if (!parsed || parsed.v !== VERSION) return EMPTY_STORE;
    return {
      v: VERSION,
      profile: parsed.profile ?? null,
      onboarding: parsed.onboarding ?? null,
      favorites: parsed.favorites ?? {},
      plans: parsed.plans ?? {},
    };
  } catch {
    return EMPTY_STORE;
  }
}

export function saveStore(store: StoreShape): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable (private mode) — in-memory state still updates */
  }
  window.dispatchEvent(new CustomEvent(STORE_EVENT, {}));
}

// ── React hooks ──────────────────────────────────────────────────────────────

function useStore(): [StoreShape, (mutate: (store: StoreShape) => StoreShape) => void] {
  const [state, setState] = useState<StoreShape>(loadStore);
  useEffect(() => {
    const sync = (): void => setState(loadStore());
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = useCallback((mutate: (store: StoreShape) => StoreShape) => {
    const next = mutate(loadStore());
    saveStore(next);
    setState(next);
  }, []);
  return [state, update];
}

export function useProfile(): {
  profile: ProfileState | null;
  save: (profile: ProfileState) => void;
} {
  const [state, update] = useStore();
  return {
    profile: state.profile,
    save: (next) => update((store) => setProfile(store, next)),
  };
}

export function useOnboarding(): {
  onboarding: OnboardingState | null;
  save: (state: OnboardingState) => void;
  reset: () => void;
  acknowledgeLineup: (actKeys: string[]) => void;
} {
  const [state, update] = useStore();
  return {
    onboarding: state.onboarding,
    save: (next) => update((store) => setOnboarding(store, next)),
    reset: () => update((store) => setOnboarding(store, null)),
    acknowledgeLineup: (actKeys) => update((store) => acknowledgeLineup(store, actKeys)),
  };
}

export function useFavorites(festivalId: string | undefined): {
  keys: Set<string>;
  isFavorite: (actKey: string) => boolean;
  toggle: (actKey: string) => void;
  clear: () => void;
  count: number;
} {
  const [state, update] = useStore();
  const list = festivalId ? favoritesOf(state, festivalId) : [];
  const keys = useMemo(() => new Set(list), [list.join("\u0000")]);
  return {
    keys,
    isFavorite: (actKey) => keys.has(actKey),
    toggle: (actKey) => festivalId && update((store) => toggleFavorite(store, festivalId, actKey)),
    clear: () => festivalId && update((store) => clearFavorites(store, festivalId)),
    count: keys.size,
  };
}

export function usePlan(
  festivalId: string | undefined,
  dayKey: string | undefined
): {
  plan: PersistedPlan | null;
  save: (slots: PlanSlot[]) => void;
  clear: () => void;
} {
  const [state, update] = useStore();
  const key = festivalId && dayKey ? planKey(festivalId, dayKey) : null;
  return {
    plan: key ? state.plans[key] ?? null : null,
    save: (slots) => festivalId && dayKey && update((store) => setPlan(store, festivalId, dayKey, slots)),
    clear: () => festivalId && dayKey && update((store) => clearPlan(store, festivalId, dayKey)),
  };
}
