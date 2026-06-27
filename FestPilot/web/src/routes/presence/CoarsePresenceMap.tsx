/**
 * Coarse presence on the map (Gate 5.2 — DEC-015/046). The privacy-correct rendering: the client
 * has NO member coordinate, only a coarse label ("at MAINSTAGE" / "between A & B"). So we place each
 * sharing member's blob at the resolved STAGE's georeferenced position (from the map transform),
 * fanned out when several share a stage. Never a precise dot — that rides Phase 6 (DEC-046).
 */
import { useEffect, useMemo, useState } from "react";
import { geoToSvg, type MapTransform } from "../../map/transform";
import { indexPrecise } from "../../map/presencePins";
import { mapBaseUrl } from "../../map/mapBase";
import { useAppearance } from "../../app/settings";
import { initialsOf } from "../../data/identity";
import type { PrecisePresenceDto, PresenceMemberDto } from "../../data/types";

interface Pin {
  id: string;
  xPct: number;
  yPct: number;
  label: string;
  color: string;
  darkText: boolean;
  live: boolean;
  precise: boolean;
}

const FAN_RADIUS = 18;
const FALLBACK_COLOR = "#6B7280";

function buildPins(
  t: MapTransform,
  members: PresenceMemberDto[],
  precise: readonly PrecisePresenceDto[]
): Pin[] {
  const byName = new Map(t.stages.map((s) => [s.name, s] as const));
  const preciseById = indexPrecise(precise);
  const { width: cw, height: ch } = t.canvas;
  const perStage = new Map<string, number>();
  const pins: Pin[] = [];

  for (const m of members) {
    const p = m.presence;
    const exact = preciseById.get(m.userId);
    if (!exact && (m.shareMode === "ghost" || !p || p.stale)) continue;

    let point: [number, number] | null = null;
    if (exact) {
      point = geoToSvg(t.affine, exact.lng, exact.lat);
    } else if (p) {
      const primary = p.stageName ? byName.get(p.stageName) : undefined;
      if (p.coarseLabel === "between" && primary && p.betweenStageName) {
        const second = byName.get(p.betweenStageName);
        if (second) point = geoToSvg(t.affine, (primary.lng + second.lng) / 2, (primary.lat + second.lat) / 2);
      }
      if (!point && primary) point = geoToSvg(t.affine, primary.lng, primary.lat);
    }
    if (!point) continue;

    let x = point[0];
    let y = point[1];
    if (!exact && p) {
      const key = p.stageName ?? "?";
      const seat = perStage.get(key) ?? 0;
      perStage.set(key, seat + 1);
      const angle = seat * 1.2;
      const radius = seat === 0 ? 0 : FAN_RADIUS;
      x += Math.cos(angle) * radius;
      y += Math.sin(angle) * radius;
    }

    pins.push({
      id: m.userId,
      xPct: Math.max(5, Math.min(95, (x / cw) * 100)),
      yPct: Math.max(9, Math.min(91, (y / ch) * 100)),
      label: initialsOf(m.displayName),
      color: m.isYou ? "var(--accent)" : m.avatarColor ?? FALLBACK_COLOR,
      darkText: m.isYou,
      live: m.live || !!exact,
      precise: !!exact,
    });
  }
  return pins;
}

export function CoarsePresenceMap({
  festivalId = "tomorrowland-deschorre",
  members,
  precise = [],
  onOpen,
  showBase = true,
}: {
  festivalId?: string;
  members: PresenceMemberDto[];
  /** Exact pins for precise+live members (DEC-099); plotted at their real coordinate. */
  precise?: readonly PrecisePresenceDto[];
  onOpen?: () => void;
  /** Render the real venue map behind the pins (the mini-map preview). Off for the full-screen
   *  precise-sharing backdrop, which keeps the plain tint so the scrim + dot read clearly. */
  showBase?: boolean;
}): JSX.Element {
  const { palette } = useAppearance();
  const [t, setT] = useState<MapTransform | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/maps/${festivalId}-transform.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no map"))))
      .then((d: MapTransform) => alive && setT(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [festivalId]);

  const pins = useMemo(() => (t ? buildPins(t, members, precise) : []), [t, members, precise]);
  // With the base shown, match the tile to the map's aspect so percentage-placed pins land exactly
  // on the venue (object-fit: fill, same as the convergence map).
  const withBase = showBase && t;
  const base = mapBaseUrl(festivalId, palette);

  return (
    <button
      type="button"
      className={`presence-maptile${withBase ? " presence-maptile--map" : ""}`}
      onClick={onOpen}
      aria-label="Open the full map"
    >
      {withBase && (
        <img className="presence-map-base" src={base} width={t.canvas.width} height={t.canvas.height} alt="" draggable={false} />
      )}
      {pins.map((p) => (
        <span
          key={p.id}
          className={`mpin${p.live ? " is-live" : ""}${p.precise ? " is-precise" : ""}`}
          style={{ left: `${p.xPct}%`, top: `${p.yPct}%`, background: p.color, color: p.darkText ? "#0F0D09" : "#fff" }}
        >
          {p.label}
        </span>
      ))}
      <span className="presence-maptile-hint">tap to open map</span>
    </button>
  );
}
