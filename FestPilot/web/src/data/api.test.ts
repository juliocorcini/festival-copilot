import { afterEach, describe, expect, it, vi } from "vitest";
import { api, API_BASE, ApiError, slotToShareInput } from "./api";
import type { PlanSlot } from "../domain/types";

type FetchImpl = (input: unknown, init?: unknown) => Promise<unknown>;

function stubFetch(impl: FetchImpl): ReturnType<typeof vi.fn> {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

afterEach(() => vi.unstubAllGlobals());

describe("api client", () => {
  it("unwraps the festivals envelope and sends a JSON accept header", async () => {
    const fetchMock = stubFetch(async () =>
      ok({ festivals: [{ id: "f1", name: "X", slug: "x", timezone: "Europe/Brussels", revision: 1 }] })
    );
    const list = await api.listFestivals();
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("f1");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE}/api/festivals`,
      expect.objectContaining({ headers: { accept: "application/json" } })
    );
  });

  it("only adds query params that are provided", async () => {
    const fetchMock = stubFetch(async () => ok({ festival: {}, weekends: [], stages: [], performances: [] }));
    await api.getLineup("f1", { weekend: "W1" });
    expect(fetchMock.mock.calls[0]![0]).toBe(`${API_BASE}/api/festivals/f1/lineup?weekend=W1`);
    await api.getLineup("f1", { weekend: "W2", day: "SATURDAY" });
    expect(fetchMock.mock.calls[1]![0]).toBe(`${API_BASE}/api/festivals/f1/lineup?weekend=W2&day=SATURDAY`);
    await api.getLineup("f1", {});
    expect(fetchMock.mock.calls[2]![0]).toBe(`${API_BASE}/api/festivals/f1/lineup`);
  });

  it("unwraps the stages envelope", async () => {
    stubFetch(async () => ok({ stages: [{ id: "s1", sourceStageId: "a", name: "MAINSTAGE", sortOrder: 0 }] }));
    const stages = await api.listStages("f1");
    expect(stages[0]!.name).toBe("MAINSTAGE");
  });

  it("throws ApiError carrying the HTTP status on a non-2xx response", async () => {
    stubFetch(async () => fail(404));
    await expect(api.getMap("f1")).rejects.toBeInstanceOf(ApiError);
    await expect(api.getMap("f1")).rejects.toMatchObject({ status: 404 });
  });

  it("maps a network failure to ApiError(status 0)", async () => {
    stubFetch(async () => {
      throw new TypeError("network down");
    });
    await expect(api.health()).rejects.toMatchObject({ name: "ApiError", status: 0 });
  });
});

describe("slotToShareInput — squad guardrail (DEC-073/074)", () => {
  const base: PlanSlot = {
    setId: "perf1",
    actKey: "act1",
    label: "ARTBAT",
    stageId: "s1",
    stageName: "CORE",
    startMs: 1000,
    endMs: 5000,
    cutMs: null,
    lateStartMs: null,
  };

  it("shares only the set id (and an early-leave), never a personal arrive-late shift", () => {
    const withLate: PlanSlot = { ...base, cutMs: 4000, lateStartMs: 2000 };
    const payload = slotToShareInput(withLate);
    expect(payload.performanceId).toBe("perf1");
    expect(payload.endOverrideUtc).toBe(new Date(4000).toISOString()); // the cut is shared
    // The personal arrive-late shift is NEVER serialized — it must not reach the squad plan.
    expect(payload).not.toHaveProperty("startOverrideUtc");
    expect(JSON.stringify(payload)).not.toContain("2000");
  });

  it("emits a null early-leave when the user attends the full set", () => {
    expect(slotToShareInput(base)).toEqual({ performanceId: "perf1", endOverrideUtc: null });
  });
});
