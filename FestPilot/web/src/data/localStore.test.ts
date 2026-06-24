import { beforeEach, describe, expect, it } from "vitest";
import type { PlanSlot } from "../domain/types";
import {
  clearFavorites,
  clearPlan,
  EMPTY_STORE,
  favoritesOf,
  loadStore,
  planKey,
  saveStore,
  setOnboarding,
  setPlan,
  setProfile,
  STORE_KEY,
  toggleFavorite,
  type StoreShape,
} from "./localStore";

function slot(id: string, startMin: number, endMin: number): PlanSlot {
  return {
    setId: id,
    actKey: id,
    label: id,
    stageId: "s",
    stageName: "Stage",
    startMs: startMin * 60_000,
    endMs: endMin * 60_000,
    cutMs: null,
  };
}

describe("favorites reducers", () => {
  it("toggles an act on and off without touching other festivals", () => {
    let store: StoreShape = { ...EMPTY_STORE, favorites: { other: ["x"] } };
    store = toggleFavorite(store, "tml", "amelie");
    expect(favoritesOf(store, "tml")).toEqual(["amelie"]);
    expect(favoritesOf(store, "other")).toEqual(["x"]);
    store = toggleFavorite(store, "tml", "adam");
    store = toggleFavorite(store, "tml", "amelie");
    expect(favoritesOf(store, "tml")).toEqual(["adam"]);
  });

  it("clears one festival's favorites only", () => {
    let store: StoreShape = { ...EMPTY_STORE };
    store = toggleFavorite(store, "tml", "a");
    store = clearFavorites(store, "tml");
    expect(favoritesOf(store, "tml")).toEqual([]);
  });
});

describe("identity profile reducer (DEC-060)", () => {
  it("trims the name and keeps a valid email", () => {
    const store = setProfile(EMPTY_STORE, { name: "  Julio  ", email: " j@x.com " });
    expect(store.profile).toEqual({ name: "Julio", email: "j@x.com" });
  });

  it("drops an empty/whitespace email (email is optional)", () => {
    expect(setProfile(EMPTY_STORE, { name: "Julio", email: "   " }).profile).toEqual({ name: "Julio" });
    expect(setProfile(EMPTY_STORE, { name: "Julio" }).profile).toEqual({ name: "Julio" });
  });

  it("round-trips the profile through localStorage", () => {
    localStorage.clear();
    saveStore(setProfile(EMPTY_STORE, { name: "Julio", email: "j@x.com" }));
    expect(loadStore().profile).toEqual({ name: "Julio", email: "j@x.com" });
  });
});

describe("onboarding + plan reducers", () => {
  it("stores onboarding selection", () => {
    const store = setOnboarding(EMPTY_STORE, {
      festivalId: "tml",
      weekendIds: ["w1"],
      dayKeys: ["2026-07-18"],
      completed: true,
    });
    expect(store.onboarding?.completed).toBe(true);
    expect(store.onboarding?.dayKeys).toEqual(["2026-07-18"]);
  });

  it("saves and clears a plan keyed by festival + day", () => {
    let store = setPlan(EMPTY_STORE, "tml", "2026-07-18", [slot("a", 0, 60), slot("b", 60, 120)]);
    expect(store.plans[planKey("tml", "2026-07-18")]!.slots).toHaveLength(2);
    store = clearPlan(store, "tml", "2026-07-18");
    expect(store.plans[planKey("tml", "2026-07-18")]).toBeUndefined();
  });
});

describe("persistence", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips through localStorage", () => {
    const store = toggleFavorite(EMPTY_STORE, "tml", "amelie");
    saveStore(store);
    expect(favoritesOf(loadStore(), "tml")).toEqual(["amelie"]);
  });

  it("falls back to empty on corrupt JSON or a version mismatch", () => {
    localStorage.setItem(STORE_KEY, "{not json");
    expect(loadStore()).toEqual(EMPTY_STORE);
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: 99, favorites: { tml: ["x"] } }));
    expect(loadStore()).toEqual(EMPTY_STORE);
  });
});
