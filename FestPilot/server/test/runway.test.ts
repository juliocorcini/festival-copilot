import { describe, expect, it } from "vitest";
import { estimateRunway, FREE_TIER_SERVICES, GIB } from "../src/api/runway";

describe("estimateRunway (R11.4 / DEC-057c)", () => {
  it("computes days-left for a cumulative limit at the current growth rate", () => {
    // Half of a 10 GiB ceiling, growing 0.5 GiB/day → 5 GiB remaining / 0.5 = 10 days.
    const r = estimateRunway({ used: 5 * GIB, ceiling: 10 * GIB, perDayRate: 0.5 * GIB, kind: "cumulative" });
    expect(r.usedPct).toBe(50);
    expect(r.daysLeft).toBe(10);
    expect(r.status).toBe("watch"); // <=30 days out
  });

  it("flags critical when a cumulative limit is nearly full", () => {
    const r = estimateRunway({ used: 9.5 * GIB, ceiling: 10 * GIB, perDayRate: 0.01 * GIB, kind: "cumulative" });
    expect(r.usedPct).toBe(95);
    expect(r.status).toBe("critical");
  });

  it("flags critical when a cumulative limit runs out within a week regardless of fill", () => {
    // Empty but burning fast: 100 units, 20/day → 5 days left.
    const r = estimateRunway({ used: 0, ceiling: 100, perDayRate: 20, kind: "cumulative" });
    expect(r.usedPct).toBe(0);
    expect(r.daysLeft).toBe(5);
    expect(r.status).toBe("critical");
  });

  it("returns no days-left when a cumulative limit is not growing", () => {
    const r = estimateRunway({ used: 2 * GIB, ceiling: 10 * GIB, perDayRate: 0, kind: "cumulative" });
    expect(r.daysLeft).toBeNull();
    expect(r.status).toBe("ok");
  });

  it("never reports days-left for a daily-reset limit — only today's fill", () => {
    const r = estimateRunway({ used: 80_000, ceiling: 100_000, perDayRate: 50_000, kind: "daily" });
    expect(r.usedPct).toBe(80);
    expect(r.daysLeft).toBeNull(); // resets at 00:00 UTC
    expect(r.status).toBe("watch");
  });

  it("flags a daily-reset limit critical once today's fill passes 90%", () => {
    const r = estimateRunway({ used: 95_000, ceiling: 100_000, perDayRate: 0, kind: "daily" });
    expect(r.usedPct).toBe(95);
    expect(r.status).toBe("critical");
  });

  it("is safe with a zero ceiling and clamps the percentage", () => {
    expect(estimateRunway({ used: 10, ceiling: 0, perDayRate: 1, kind: "cumulative" }).usedPct).toBe(0);
    const over = estimateRunway({ used: 200, ceiling: 100, perDayRate: 0, kind: "daily" });
    expect(over.usedPct).toBe(100); // clamped, not 200
    expect(over.status).toBe("critical");
  });

  it("encodes the verified free-tier ceilings as data", () => {
    const r2 = FREE_TIER_SERVICES.find((s) => s.id === "r2_storage")!;
    expect(r2.ceiling).toBe(10 * GIB);
    expect(r2.kind).toBe("cumulative");
    const workers = FREE_TIER_SERVICES.find((s) => s.id === "workers_requests")!;
    expect(workers.ceiling).toBe(100_000);
    expect(workers.kind).toBe("daily");
  });
});
