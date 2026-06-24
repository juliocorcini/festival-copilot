/**
 * Privacy-correct presence on the full map (DEC-058, R2.3). The client never holds a member's
 * coordinate — only a coarse label ("at MAINSTAGE" / "between A & B"). So each sharing member is
 * placed at the resolved STAGE's georeferenced point (via the map affine), fanned out when several
 * share a stage. The returned pin carries ONLY screen coordinates — never a `lng`/`lat` — so the
 * coarse feed's no-raw-coords guarantee holds end to end.
 *
 * `isOutsideVenue` is the out-of-venue predicate (DEC-051): a device fix beyond the venue bbox
 * (plus a small margin) means "me" can't be placed inside the art, so the map shows an honest
 * state instead of a black void.
 */
import { initialsOf } from "../data/identity";
import { geoToSvg, type MapTransform } from "./transform";
import type { PresenceMemberDto } from "../data/types";

export interface MapPin {
  id: string;
  /** SVG canvas coordinates (never a real lng/lat — privacy). */
  x: number;
  y: number;
  initials: string;
  name: string;
  /** Dot fill — the member's avatar colour, or the accent for "you". */
  color: string;
  darkText: boolean;
  live: boolean;
  isYou: boolean;
}

const FAN_RADIUS = 16;
const FALLBACK_COLOR = "#6B7280";
const YOU_COLOR = "var(--accent)";

/**
 * Stage-anchor every sharing member onto the illustration. Ghosts, members with no fix, and stale
 * fixes are dropped (they belong in the roster, not the map). "between A & B" lands on the midpoint.
 */
export function coarsePresencePins(t: MapTransform, members: PresenceMemberDto[]): MapPin[] {
  const byName = new Map(t.stages.map((s) => [s.name, s] as const));
  const perStage = new Map<string, number>();
  const pins: MapPin[] = [];

  for (const m of members) {
    const p = m.presence;
    if (m.shareMode === "ghost" || !p || p.stale) continue;

    const primary = p.stageName ? byName.get(p.stageName) : undefined;
    let point: [number, number] | null = null;
    if (p.coarseLabel === "between" && primary && p.betweenStageName) {
      const second = byName.get(p.betweenStageName);
      if (second) point = geoToSvg(t.affine, (primary.lng + second.lng) / 2, (primary.lat + second.lat) / 2);
    }
    if (!point && primary) point = geoToSvg(t.affine, primary.lng, primary.lat);
    if (!point) continue;

    const key = p.stageName ?? "?";
    const seat = perStage.get(key) ?? 0;
    perStage.set(key, seat + 1);
    const angle = seat * 1.2;
    const radius = seat === 0 ? 0 : FAN_RADIUS;

    pins.push({
      id: m.userId,
      x: point[0] + Math.cos(angle) * radius,
      y: point[1] + Math.sin(angle) * radius,
      initials: initialsOf(m.displayName),
      name: m.isYou ? "You" : m.displayName ?? "Guest",
      color: m.isYou ? YOU_COLOR : m.avatarColor ?? FALLBACK_COLOR,
      darkText: m.isYou,
      live: m.live,
      isYou: m.isYou,
    });
  }
  return pins;
}

export interface Bbox {
  west: number;
  east: number;
  south: number;
  north: number;
}

const DEG_PER_METER_LAT = 1 / 111320;

/**
 * Is a device fix outside the venue? True when the coordinate falls beyond the bbox plus a small
 * margin (so standing just at a gate still counts as "inside"). The margin is expressed in metres
 * and converted to degrees at the bbox's mid-latitude.
 */
export function isOutsideVenue(bbox: Bbox, lng: number, lat: number, marginMeters = 150): boolean {
  const midLat = (bbox.south + bbox.north) / 2;
  const dLat = marginMeters * DEG_PER_METER_LAT;
  const dLng = marginMeters / (111320 * Math.max(0.1, Math.cos((midLat * Math.PI) / 180)));
  return lng < bbox.west - dLng || lng > bbox.east + dLng || lat < bbox.south - dLat || lat > bbox.north + dLat;
}
