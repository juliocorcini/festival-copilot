// R11.4 (DEC-057c): free-tier runway math — pure, no I/O, fully unit-tested. Given current usage
// and a per-day growth rate against a known free-tier ceiling, estimate how close we are and, for
// cumulative limits (storage), how many days until we hit the ceiling at the current rate.
//
// Two limit shapes:
//   - "cumulative" (R2 storage, D1 storage): usage accrues; daysLeft = remaining / perDayRate.
//   - "daily"      (Workers requests/day, D1 rows/day): the allowance RESETS at 00:00 UTC, so
//                  "days until the limit" is meaningless — what matters is today's projected usage
//                  vs the daily cap. daysLeft is null; status reflects the projected percentage.

export type LimitKind = "cumulative" | "daily";
export type RunwayStatus = "ok" | "watch" | "critical";

export interface RunwaySample {
  /** Current usage. For "daily" this is today's usage so far (or projected). */
  used: number;
  /** Free-tier ceiling in the same unit as `used`. */
  ceiling: number;
  /** Average growth per day (cumulative) or recent daily volume (daily). >= 0. */
  perDayRate: number;
  kind: LimitKind;
}

export interface RunwayEstimate {
  usedPct: number; // 0..100, clamped
  perDayRate: number;
  /** Whole days until the ceiling at the current rate; null when not applicable (daily reset, or no growth). */
  daysLeft: number | null;
  status: RunwayStatus;
}

const clampPct = (v: number): number => Math.max(0, Math.min(100, v));

/** Status from how full we are plus, for cumulative limits, how soon we run out. */
function deriveStatus(usedPct: number, daysLeft: number | null): RunwayStatus {
  if (usedPct >= 90 || (daysLeft !== null && daysLeft <= 7)) return "critical";
  if (usedPct >= 70 || (daysLeft !== null && daysLeft <= 30)) return "watch";
  return "ok";
}

export function estimateRunway(sample: RunwaySample): RunwayEstimate {
  const ceiling = Math.max(0, sample.ceiling);
  const used = Math.max(0, sample.used);
  const rate = Math.max(0, sample.perDayRate);
  const usedPct = ceiling > 0 ? clampPct((used / ceiling) * 100) : 0;

  let daysLeft: number | null = null;
  if (sample.kind === "cumulative" && rate > 0) {
    const remaining = Math.max(0, ceiling - used);
    daysLeft = Math.floor(remaining / rate);
  }

  return { usedPct: Math.round(usedPct * 10) / 10, perDayRate: rate, daysLeft, status: deriveStatus(usedPct, daysLeft) };
}

// --- Free-tier ceilings (VERIFIED 2026-06-24 from Cloudflare docs: workers/platform/pricing,
// workers/platform/limits, d1/platform/pricing). Encoded as data so the runway is data-driven. ---

export const GIB = 1024 * 1024 * 1024;

export interface FreeTierService {
  id: string;
  label: string;
  ceiling: number;
  unit: "bytes" | "count";
  kind: LimitKind;
  /** True when FestPilot measures this exactly first-party; false when it needs platform analytics. */
  firstParty: boolean;
  note: string;
}

export const FREE_TIER_SERVICES: FreeTierService[] = [
  {
    id: "r2_storage",
    label: "R2 storage",
    ceiling: 10 * GIB,
    unit: "bytes",
    kind: "cumulative",
    firstParty: true,
    note: "Avatars + meeting photos, measured from the media ledger.",
  },
  {
    id: "workers_requests",
    label: "Workers requests / day",
    ceiling: 100_000,
    unit: "count",
    kind: "daily",
    firstParty: false,
    note: "First-party app touches only — a lower bound on total Worker requests.",
  },
  {
    id: "d1_rows_written",
    label: "D1 rows written / day",
    ceiling: 100_000,
    unit: "count",
    kind: "daily",
    firstParty: false,
    note: "Exact figure needs Cloudflare Analytics; not yet connected.",
  },
];
