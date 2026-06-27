/**
 * Convergence map for a meeting point (#26.3). The meeting pin sits at its EXACT spot (the creator's
 * explicit share, DEC-046). Squad pins are placed at each member's COARSE stage (the same privacy-safe
 * rendering as the presence map — never a raw member coordinate, DEC-015), with a dashed line drawn
 * from each toward the spot so the "everyone converging" read is immediate.
 *
 * E14/DEC-100 (Gate 6.3): the SOS/meeting map is now PAN + ZOOM, reusing the exact shared infra the
 * full map uses — `usePanZoom` over the single transformed "world" layer + the unified base raster
 * (DEC-090) with its honest zoom ceiling (DEC-075). No more pinned, frozen mini-map: you can pinch in
 * to see exactly where the spot is. A separate "Open full map" button replaces tap-to-open (which
 * would now conflict with the pan gesture). Degrades to the base + meeting pin when presence is empty.
 */
import { useEffect, useMemo, useState } from "react";
import { geoToSvg, type MapTransform } from "../../map/transform";
import { mapBaseUrl } from "../../map/mapBase";
import { usePanZoom } from "../../map/usePanZoom";
import { maxScaleForBase, NO_INSETS } from "../../map/panClamp";
import { useAppearance } from "../../app/settings";
import { initialsOf } from "../../data/identity";
import { readableInkOn } from "../../lib/contrast";
import { useT } from "../../i18n";
import type { PresenceMemberDto } from "../../data/types";

const FAN_RADIUS = 16;
const FALLBACK_COLOR = "#6B7280";

/** A converging squadmate, in world (canvas) coordinates so it lives inside the pan/zoom layer. */
interface MemberPin {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
}

/** A member's coarse stage point in canvas coordinates (never their raw fix — DEC-015). */
function coarsePoint(t: MapTransform, m: PresenceMemberDto): [number, number] | null {
  const p = m.presence;
  if (m.shareMode === "ghost" || !p || p.stale) return null;
  const byName = new Map(t.stages.map((s) => [s.name, s] as const));
  const primary = p.stageName ? byName.get(p.stageName) : undefined;
  if (p.coarseLabel === "between" && primary && p.betweenStageName) {
    const second = byName.get(p.betweenStageName);
    if (second) return geoToSvg(t.affine, (primary.lng + second.lng) / 2, (primary.lat + second.lat) / 2);
  }
  return primary ? geoToSvg(t.affine, primary.lng, primary.lat) : null;
}

export function MeetConvergenceMap({
  lat,
  lng,
  members,
  festivalId = "tomorrowland-deschorre",
  onOpen,
}: {
  lat: number;
  lng: number;
  members: PresenceMemberDto[];
  festivalId?: string;
  onOpen?: () => void;
}): JSX.Element {
  const { palette } = useAppearance();
  const t = useT();
  const [transform, setTransform] = useState<MapTransform | null>(null);
  const [baseNaturalW, setBaseNaturalW] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/maps/${festivalId}-transform.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no map"))))
      .then((d: MapTransform) => alive && setTransform(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [festivalId]);

  const cw = transform?.canvas.width ?? 1000;
  const ch = transform?.canvas.height ?? 1000;
  // Same honest zoom ceiling as the full map: the loaded base's resolution caps how far you can zoom.
  const maxScale = maxScaleForBase(baseNaturalW, cw);
  const { ref, view, recenter, handlers } = usePanZoom(cw, ch, NO_INSETS, maxScale);

  const meet = useMemo(() => (transform ? geoToSvg(transform.affine, lng, lat) : null), [transform, lng, lat]);

  const pins = useMemo<MemberPin[]>(() => {
    if (!transform) return [];
    const perStage = new Map<string, number>();
    const out: MemberPin[] = [];
    for (const m of members) {
      if (m.isYou) continue; // the spot owner / "you" is implied by the convergence target
      const point = coarsePoint(transform, m);
      if (!point) continue;
      const key = m.presence?.stageName ?? "?";
      const seat = perStage.get(key) ?? 0;
      perStage.set(key, seat + 1);
      const radius = seat === 0 ? 0 : FAN_RADIUS;
      out.push({
        id: m.userId,
        x: point[0] + Math.cos(seat * 1.2) * radius,
        y: point[1] + Math.sin(seat * 1.2) * radius,
        label: initialsOf(m.displayName),
        color: m.avatarColor ?? FALLBACK_COLOR,
      });
    }
    return out;
  }, [transform, members]);

  const inv = 1 / view.scale; // keep markers + line weight a constant screen size at any zoom
  const pinScale = Math.min(inv, 1.6);
  const base = mapBaseUrl(festivalId, palette);
  const mx = meet?.[0] ?? cw / 2;
  const my = meet?.[1] ?? ch * 0.4;

  return (
    <div className="meet-convergence" style={{ aspectRatio: `${cw} / ${ch}` }}>
      <div className="viewport meet-converge-viewport" ref={ref} {...handlers}>
        <div
          className="world"
          style={{ width: cw, height: ch, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          {transform && (
            <img
              className={`base${baseNaturalW > 0 ? " is-loaded" : ""}`}
              src={base}
              width={cw}
              height={ch}
              alt=""
              draggable={false}
              onLoad={(e) => setBaseNaturalW(e.currentTarget.naturalWidth || 1)}
              onError={() => setBaseNaturalW((w) => w || 1)}
            />
          )}
          <svg className="overlay" viewBox={`0 0 ${cw} ${ch}`} width={cw} height={ch}>
            {meet &&
              pins.map((p) => (
                <line
                  key={p.id}
                  x1={p.x}
                  y1={p.y}
                  x2={mx}
                  y2={my}
                  stroke="rgba(245,166,35,.5)"
                  strokeWidth={2 * inv}
                  strokeDasharray={`${6 * inv} ${6 * inv}`}
                />
              ))}
            {pins.map((p) => (
              <g key={p.id} transform={`translate(${p.x},${p.y}) scale(${pinScale})`} className="meet-converge-pin">
                <circle className="pres-disc" r="8.5" style={{ fill: p.color }} />
                <text y="3" textAnchor="middle" style={{ fill: readableInkOn(p.color), font: "700 8px Inter, sans-serif" }}>
                  {p.label}
                </text>
              </g>
            ))}
            {meet && (
              <g transform={`translate(${mx},${my}) scale(${pinScale})`} className="meet-converge-target">
                <circle className="meet-converge-target-ring" r="11" />
                <circle className="meet-converge-target-disc" r="6.5" />
                <circle className="meet-converge-target-dot" r="2.4" />
              </g>
            )}
          </svg>
        </div>
      </div>
      <button className="recenter meet-converge-recenter" onClick={recenter} aria-label={t("map.recenter")}>
        ⤢
      </button>
      {onOpen && (
        <button className="btn btn-ghost btn-sm meet-converge-open" onClick={onOpen}>
          <span className="ms" aria-hidden="true">map</span>
          {t("meetnav.openFullMap")}
        </button>
      )}
    </div>
  );
}
