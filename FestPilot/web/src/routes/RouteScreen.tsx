/**
 * B7.4 stage-to-stage routing + B7.5 walking guidance (#29, DEC-011/022). From your current set's
 * stage to your next set's stage (or any manual pick), it draws the leg on the georeferenced map and
 * shows walk time, distance and a "leave by" nudge tied to the set start. The math is pure
 * (`domain/route.ts` over the real travel matrix); live position is deferred to presence (Phase 5),
 * so "Start walking" is a lightweight, GPS-free guidance card.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAppearance } from "../app/settings";
import { api } from "../data/api";
import { useLineup } from "../data/useLineup";
import { useOnboarding, usePlan } from "../data/localStore";
import { useTravelMatrix } from "../data/useTravelMatrix";
import type { FestivalMapDto } from "../data/types";
import { buildNowNext } from "../domain/nowNext";
import { buildRouteLeg, type RouteEndpoint } from "../domain/route";
import type { LatLng } from "../domain/travel";
import { geoToSvg } from "../map/transform";
import { usePanZoom } from "../map/usePanZoom";
import { daysForWeekends } from "../lib/festival";
import { stageColor, timeInZone } from "../lib/format";
import { EmptyState, LoadingState } from "../ui/states";

function normalizeName(name: string): string {
  return name.trim().toUpperCase();
}

const hhmm = (ms: number, tz: string): string => timeInZone(new Date(ms).toISOString(), tz);

export function RouteScreen(): JSX.Element {
  const { status, lineup } = useLineup();
  const { onboarding } = useOnboarding();
  const travel = useTravelMatrix(lineup);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { palette } = useAppearance();

  const [map, setMap] = useState<FestivalMapDto | null>(null);
  const [now] = useState(() => Date.now());
  const [walking, setWalking] = useState(false);
  const [override, setOverride] = useState<{ from?: string; to?: string }>({});

  const festivalId = lineup?.festival.id;
  const tz = lineup?.festival.timezone ?? "UTC";

  useEffect(() => {
    if (!festivalId) return;
    const ctrl = new AbortController();
    let alive = true;
    api.getMap(festivalId, ctrl.signal).then((m) => alive && setMap(m)).catch(() => {});
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [festivalId]);

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const days = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds) : []), [lineup, weekendIds]);
  const dayKey = params.get("day") ?? onboarding?.dayKeys?.[0] ?? days[0]?.key ?? undefined;
  const plan = usePlan(festivalId, dayKey);

  const stages = useMemo(() => lineup?.stages ?? [], [lineup]);
  const stageName = useMemo(() => new Map(stages.map((s) => [s.id, s.name] as const)), [stages]);
  const coordById = useMemo(() => {
    const byName = new Map<string, LatLng>();
    if (map) for (const s of map.transform.stages) if (s.matched) byName.set(normalizeName(s.name), { lat: s.lat, lng: s.lng });
    const byId = new Map<string, LatLng>();
    for (const s of stages) {
      const coord = byName.get(normalizeName(s.name));
      if (coord) byId.set(s.id, coord);
    }
    return byId;
  }, [map, stages]);

  // Plan-derived default leg: from the set you're at (or last left) to your next set, with its start.
  const planned = useMemo(() => {
    const slots = plan.plan?.slots ?? [];
    if (slots.length === 0) return null;
    const nn = buildNowNext(slots, travel, now);
    const ordered = [...slots].sort((a, b) => a.startMs - b.startMs);
    const origin = nn.live ?? [...ordered].reverse().find((s) => s.endMs <= now) ?? ordered[0]!;
    return {
      fromId: origin.stageId,
      toId: nn.next?.stageId ?? null,
      atMs: nn.next?.startMs ?? null,
      destLabel: nn.next?.label ?? null,
    };
  }, [plan.plan, travel, now]);

  const fromId = override.from ?? params.get("from") ?? planned?.fromId ?? stages[0]?.id ?? null;
  const toId =
    override.to ?? params.get("to") ?? planned?.toId ?? stages.find((s) => s.id !== fromId)?.id ?? null;

  const arriveByMs = useMemo(() => {
    if (planned && toId === planned.toId && planned.atMs != null) return planned.atMs;
    const at = params.get("at");
    if (at && params.get("to") === toId) return Number(at);
    return null;
  }, [planned, toId, params]);
  const destLabel = planned && toId === planned.toId ? planned.destLabel : null;

  const endpoint = (id: string | null): RouteEndpoint => ({
    stageId: id,
    stageName: id ? stageName.get(id) ?? "" : "",
    coord: id ? coordById.get(id) ?? null : null,
  });
  const leg = buildRouteLeg(endpoint(fromId), endpoint(toId), travel, arriveByMs);

  const tr = map?.transform;
  const cw = tr?.canvas.width ?? 1000;
  const ch = tr?.canvas.height ?? 1291;
  const { ref, view, recenter, handlers } = usePanZoom(cw, ch);
  const inv = 1 / view.scale;

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup) {
    return (
      <div className="route">
        <RouteBar onBack={() => navigate(-1)} />
        <EmptyState icon="map" title="Map unavailable" message="Could not load the venue map. Try again from the Map tab." />
      </div>
    );
  }
  if (stages.length < 2) {
    return (
      <div className="route">
        <RouteBar onBack={() => navigate(-1)} />
        <EmptyState icon="route" title="Routing soon" message="Stage positions for this festival aren't published yet." />
      </div>
    );
  }

  const base = tr ? (palette === "day" ? map!.baseDayUrl : map!.baseNightUrl) : null;
  const from = geoPoint(tr?.affine, leg.from.coord);
  const to = geoPoint(tr?.affine, leg.to.coord);

  return (
    <div className="route">
      <RouteBar onBack={() => navigate(-1)} />

      {!walking && (
        <div className="route-picker glass">
          <label className="route-leg-row">
            <span className="ms" style={{ color: "var(--accent)", fontSize: 18 }}>trip_origin</span>
            <select aria-label="From stage" value={fromId ?? ""} onChange={(e) => setOverride((o) => ({ ...o, from: e.target.value }))}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <button
            className="route-swap"
            aria-label="Swap origin and destination"
            onClick={() => setOverride({ from: toId ?? undefined, to: fromId ?? undefined })}
          >
            <span className="ms" style={{ fontSize: 18 }}>swap_vert</span>
          </button>
          <label className="route-leg-row">
            <span className="ms" style={{ color: stageColor(leg.to.stageName), fontSize: 18 }}>place</span>
            <select aria-label="To stage" value={toId ?? ""} onChange={(e) => setOverride((o) => ({ ...o, to: e.target.value }))}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="route-map">
        <div className="viewport" ref={ref} {...handlers}>
          <div
            className="world"
            style={{ width: cw, height: ch, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          >
            {base && <img className="base" src={base} width={cw} height={ch} alt={`${tr!.venue} map`} draggable={false} />}
            <svg className="overlay" viewBox={`0 0 ${cw} ${ch}`} width={cw} height={ch}>
              {from && to && (
                <line className="route-line" x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} />
              )}
              {from && (
                <g transform={`translate(${from[0]},${from[1]}) scale(${inv})`}>
                  <circle className="route-from-ring" r="11" />
                  <circle className="route-from" r="6" />
                  <text y="-15" textAnchor="middle" className="lbl name">{leg.from.stageName}</text>
                </g>
              )}
              {to && (
                <g transform={`translate(${to[0]},${to[1]}) scale(${inv})`}>
                  <path className="route-to-shadow" d="M0,2 L9,-14 A10,10 0 1 0 -9,-14 Z" />
                  <path className="route-to" d="M0,0 L8,-15 A9,9 0 1 0 -8,-15 Z" style={{ fill: stageColor(leg.to.stageName) }} />
                  <text y="14" textAnchor="middle" className="lbl name">{leg.to.stageName}</text>
                </g>
              )}
            </svg>
          </div>
        </div>
        <button className="recenter" onClick={recenter} title="Fit route">⤢</button>
      </div>

      {walking ? (
        <div className="route-guidance glass">
          <span className="ms" style={{ fontSize: 34, color: "var(--accent)" }}>navigation</span>
          <div className="route-guidance-main">
            <div className="poster route-head">Head to {leg.to.stageName}</div>
            <div className="route-sub">
              {leg.minutes} min{leg.meters != null ? ` · ${leg.meters}m left` : ""}
            </div>
          </div>
          <button className="route-end" aria-label="End walking" onClick={() => setWalking(false)}>
            <span className="ms" style={{ fontSize: 18 }}>close</span> End
          </button>
        </div>
      ) : (
        <div className="route-sheet glass">
          <div className="route-sheet-top">
            <div>
              <div className="poster route-mins">{leg.minutes} min</div>
              <div className="route-sub">
                {leg.meters != null ? `${leg.meters}m · ` : ""}walk to {leg.to.stageName}
              </div>
            </div>
            {leg.leaveByMs != null && (
              <div className="route-leaveby">
                <span className="pill route-leaveby-pill">
                  <span className="ms" style={{ fontSize: 12 }}>schedule</span>
                  Leave by {hhmm(leg.leaveByMs, tz)}
                </span>
                {destLabel && leg.arriveByMs != null && (
                  <div className="route-starts">{destLabel} starts {hhmm(leg.arriveByMs, tz)}</div>
                )}
              </div>
            )}
          </div>
          <button className="btn btn-primary" onClick={() => setWalking(true)}>
            <span className="ms" style={{ fontSize: 18 }}>directions_walk</span> Start walking
          </button>
        </div>
      )}
    </div>
  );
}

function RouteBar({ onBack }: { onBack: () => void }): JSX.Element {
  return (
    <div className="route-bar">
      <button className="route-back" aria-label="Back" onClick={onBack}>
        <span className="ms" style={{ fontSize: 20 }}>arrow_back</span>
      </button>
      <span className="route-bar-title poster">Walk</span>
    </div>
  );
}

function geoPoint(affine: { a: number; b: number; c: number; d: number; e: number; f: number } | undefined, coord: LatLng | null): [number, number] | null {
  if (!affine || !coord) return null;
  return geoToSvg(affine, coord.lng, coord.lat);
}
