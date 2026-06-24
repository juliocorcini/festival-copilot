/**
 * Stage-to-stage walking route (#29 B7.4, DEC-011/022). Pure over a `TravelMatrix` (+ optional
 * coordinates) so the Map routing screen, the Now&Next "leave by" nudge and the My-Plan walk chips
 * agree on the math. Minutes come from the matrix (already detour-adjusted); metres are straight-line
 * for display only; `leaveBy` = the target set start − walk minutes. No DOM/React.
 */
import { metersBetween, type LatLng } from "./travel";
import type { TravelMatrix } from "./types";

const MIN = 60_000;

export interface RouteEndpoint {
  stageId: string | null;
  stageName: string;
  /** Georeferenced position, or null when the stage has no published coordinates. */
  coord: LatLng | null;
}

export interface RouteLeg {
  from: RouteEndpoint;
  to: RouteEndpoint;
  /** Whole-minute walk from the matrix (0 when both ends are the same stage). */
  minutes: number;
  /** Straight-line metres for display, or null when either coordinate is unknown. */
  meters: number | null;
  /** Target arrival = the destination set's start (ms), or null for an ad-hoc route. */
  arriveByMs: number | null;
  /** When you must leave to arrive on time (arriveBy − minutes), or null without a target. */
  leaveByMs: number | null;
}

/** Build a single walking leg between two stages, optionally tied to a set start time. */
export function buildRouteLeg(
  from: RouteEndpoint,
  to: RouteEndpoint,
  travel: TravelMatrix,
  arriveByMs: number | null = null,
): RouteLeg {
  const sameStage = from.stageId != null && from.stageId === to.stageId;
  const minutes = sameStage ? 0 : travel.minutesBetween(from.stageId, to.stageId);
  const meters = sameStage ? 0 : from.coord && to.coord ? Math.round(metersBetween(from.coord, to.coord)) : null;
  const leaveByMs = arriveByMs != null ? arriveByMs - minutes * MIN : null;
  return { from, to, minutes, meters, arriveByMs, leaveByMs };
}
