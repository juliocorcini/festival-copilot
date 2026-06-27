/**
 * Convergence map for a meeting point (#26.3). The meeting pin sits at its EXACT spot (the creator's
 * explicit share, DEC-046). Squad pins are placed at each member's COARSE stage (the same privacy-safe
 * rendering as the presence map — never a raw member coordinate, DEC-015), with a dashed line drawn
 * from each toward the spot so the "everyone converging" read is immediate. Degrades to just the
 * meeting pin when the map transform or presence isn't available.
 */
import { useEffect, useMemo, useState } from "react";
import { geoToSvg, type MapTransform } from "../../map/transform";
import { mapBaseUrl } from "../../map/mapBase";
import { useAppearance } from "../../app/settings";
import { initialsOf } from "../../data/identity";
import type { PresenceMemberDto } from "../../data/types";

const FAN_RADIUS = 16;
const FALLBACK_COLOR = "#6B7280";

interface MemberPin {
  id: string;
  xPct: number;
  yPct: number;
  label: string;
  color: string;
  darkText: boolean;
}

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

  const cw = t?.canvas.width ?? 1000;
  const ch = t?.canvas.height ?? 1000;
  const meet = useMemo(() => (t ? geoToSvg(t.affine, lng, lat) : null), [t, lng, lat]);

  const pins = useMemo<MemberPin[]>(() => {
    if (!t) return [];
    const perStage = new Map<string, number>();
    const out: MemberPin[] = [];
    for (const m of members) {
      if (m.isYou) continue; // the spot owner / "you" is implied by the convergence target
      const base = coarsePoint(t, m);
      if (!base) continue;
      const key = m.presence?.stageName ?? "?";
      const seat = perStage.get(key) ?? 0;
      perStage.set(key, seat + 1);
      const radius = seat === 0 ? 0 : FAN_RADIUS;
      const x = base[0] + Math.cos(seat * 1.2) * radius;
      const y = base[1] + Math.sin(seat * 1.2) * radius;
      out.push({
        id: m.userId,
        xPct: Math.max(6, Math.min(94, (x / cw) * 100)),
        yPct: Math.max(8, Math.min(92, (y / ch) * 100)),
        label: initialsOf(m.displayName),
        color: m.avatarColor ?? FALLBACK_COLOR,
        darkText: false,
      });
    }
    return out;
  }, [t, members, cw, ch]);

  const meetX = meet ? (meet[0] / cw) * 100 : 50;
  const meetY = meet ? (meet[1] / ch) * 100 : 38;
  const base = mapBaseUrl(festivalId, palette);

  return (
    <button
      type="button"
      className="meet-convergence"
      style={{ aspectRatio: `${cw} / ${ch}` }}
      onClick={onOpen}
      aria-label="Open the full map"
    >
      {t && <img className="meet-map-base" src={base} width={cw} height={ch} alt="" draggable={false} />}
      <svg className="meet-converge-lines" viewBox={`0 0 ${cw} ${ch}`} preserveAspectRatio="none" aria-hidden="true">
        {meet &&
          pins.map((p) => (
            <line
              key={p.id}
              x1={`${p.xPct}%`}
              y1={`${p.yPct}%`}
              x2={`${meetX}%`}
              y2={`${meetY}%`}
              stroke="rgba(245,166,35,.4)"
              strokeWidth={2}
              strokeDasharray="6 6"
            />
          ))}
      </svg>
      {pins.map((p) => (
        <span
          key={p.id}
          className="mpin"
          style={{ left: `${p.xPct}%`, top: `${p.yPct}%`, background: p.color, color: p.darkText ? "#0F0D09" : "#fff" }}
        >
          {p.label}
        </span>
      ))}
      <span className="meet-pin" style={{ left: `${meetX}%`, top: `${meetY}%` }}>
        <span className="ms">flag</span>
      </span>
      <span className="presence-maptile-hint">tap to open map</span>
    </button>
  );
}
