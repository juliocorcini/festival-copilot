/**
 * The georeferenced map view: the generated illustration (SVG → slim WebP base) as a pan/zoom
 * layer, with everything interactive drawn as a separate vector overlay placed through the exported
 * affine (DEC-030). Stages are crisp, screen-stable, tappable markers — never baked into the raster
 * (DEC-050) — and tapping one opens an info sheet (now-playing + next from the lineup). Day/night
 * palettes (DEC-034 §11.5) and coarse, privacy-safe labels (DEC-015).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { coarseLabel, geoToSvg, type MapTransform, type StageGeo } from "./transform";
import { useAppearance } from "../app/settings";
import { usePanZoom } from "./usePanZoom";
import { NO_INSETS, type Insets } from "./panClamp";
import { usePresence } from "./presence";
import { useLineup } from "../data/useLineup";
import { toPlannableSets } from "../domain/lineup";
import { setsAtStage, stageProgrammeAt } from "../domain/stageProgramme";
import { stageColor, timeInZone } from "../lib/format";

interface Props {
  festivalId?: string;
}

/** A small 5-point star, centred at the origin — the stage medallion glyph. */
function starPath(r: number, rin: number, n = 5): string {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 === 0 ? r : rin;
    const a = (Math.PI / n) * i - Math.PI / 2;
    d += (i === 0 ? "M" : "L") + (Math.cos(a) * rad).toFixed(2) + "," + (Math.sin(a) * rad).toFixed(2);
  }
  return d + "Z";
}
const STAR = starPath(3.6, 1.6);
const hhmm = (ms: number, tz: string): string => timeInZone(new Date(ms).toISOString(), tz);

/**
 * Measure the in-canvas chrome (top bar + bottom sheet) so the pan/zoom can treat the
 * viewport minus that chrome as the safe rect (R2.1, §6 #6). Callback refs let us re-measure
 * when the elements mount and a ResizeObserver tracks the sheet growing with the roster.
 */
function useMeasuredInsets(top: HTMLElement | null, bottom: HTMLElement | null): Insets {
  const [insets, setInsets] = useState<Insets>(NO_INSETS);
  useEffect(() => {
    const measure = (): void =>
      setInsets({ top: top?.offsetHeight ?? 0, right: 0, bottom: bottom?.offsetHeight ?? 0, left: 0 });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    if (top) ro.observe(top);
    if (bottom) ro.observe(bottom);
    return () => ro.disconnect();
  }, [top, bottom]);
  return insets;
}

export function MapView({ festivalId = "tomorrowland-deschorre" }: Props): JSX.Element {
  const [t, setT] = useState<MapTransform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode, setMode, palette } = useAppearance();
  const { lineup } = useLineup();

  useEffect(() => {
    let alive = true;
    fetch(`/maps/${festivalId}-transform.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`map ${festivalId} not found`))))
      .then((data: MapTransform) => alive && setT(data))
      .catch((e) => alive && setError(String(e.message ?? e)));
    return () => { alive = false; };
  }, [festivalId]);

  // A slow clock so "now playing" stays honest while the map is open.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const cw = t?.canvas.width ?? 1000;
  const ch = t?.canvas.height ?? 1000;
  const [topEl, setTopEl] = useState<HTMLElement | null>(null);
  const [sheetEl, setSheetEl] = useState<HTMLElement | null>(null);
  const insets = useMeasuredInsets(topEl, sheetEl);
  const { ref, view, recenter, handlers } = usePanZoom(cw, ch, insets);
  const { people, meeting } = usePresence(t?.stages ?? []);

  const sets = useMemo(
    () => (lineup ? toPlannableSets(lineup.performances, lineup.stages) : []),
    [lineup],
  );
  const timeZone = lineup?.festival.timezone ?? "UTC";

  const [openStage, setOpenStage] = useState<StageGeo | null>(null);
  // Open on tap, but ignore the click that ends a pan-drag (release far from where it started).
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const stageTap = (s: StageGeo) => ({
    onPointerDown: (e: React.PointerEvent) => {
      downAt.current = { x: e.clientX, y: e.clientY };
    },
    onClick: (e: React.MouseEvent) => {
      const d = downAt.current;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) setOpenStage(s);
    },
  });

  const inv = 1 / view.scale; // keep markers a constant screen size at any zoom
  const pinScale = Math.min(inv, 1.6); // …but don't let them balloon when zoomed all the way out

  const friends = useMemo(() => people.filter((p) => p.kind === "friend"), [people]);
  const me = people.find((p) => p.kind === "me") ?? null;

  if (error) return <div className="map-msg">Could not load the map: {error}</div>;
  if (!t) return <div className="map-msg">Loading map…</div>;

  // Slim pre-rendered raster base (DEC-040), now label-free (DEC-050); the interactive layer below
  // is a separate vector overlay so stage names/markers stay crisp and tappable at any zoom.
  const base = `/maps/${festivalId}${palette === "day" ? "-day" : ""}.webp`;
  const openProgramme = openStage ? stageProgrammeAt(sets, openStage.name, nowMs) : null;
  const openAtStage = openStage ? setsAtStage(sets, openStage.name) : [];

  return (
    <div className="map">
      <div className="viewport" ref={ref} {...handlers}>
        <div
          className="world"
          style={{
            width: cw,
            height: ch,
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          }}
        >
          <img className="base" src={base} width={cw} height={ch} alt={`${t.venue} map`} draggable={false} />
          <svg className="overlay" viewBox={`0 0 ${cw} ${ch}`} width={cw} height={ch}>
            {t.stages.map((s) => {
              const [x, y] = geoToSvg(t.affine, s.lng, s.lat);
              const live = stageProgrammeAt(sets, s.name, nowMs).now;
              const selected = openStage?.name === s.name;
              return (
                <g
                  key={s.name}
                  className={`stage-pin${selected ? " is-open" : ""}`}
                  transform={`translate(${x},${y}) scale(${pinScale})`}
                  role="button"
                  aria-label={`${s.name}${live ? `, now playing ${live.label}` : ""}`}
                  {...stageTap(s)}
                >
                  <ellipse className="stage-pin-shadow" cx="0" cy="3.4" rx="6.8" ry="2.4" />
                  <circle className="stage-pin-disc" r="7" style={{ fill: stageColor(s.name) }} />
                  <path className="stage-pin-star" d={STAR} />
                  {live && <circle className="stage-pin-live" cx="6.2" cy="-6.2" r="2.7" />}
                  <text className="lbl stage-pin-name" x="11" y="3.5">{s.name}</text>
                </g>
              );
            })}

            {meeting && (() => {
              const [x, y] = geoToSvg(t.affine, meeting.lng, meeting.lat);
              return (
                <g transform={`translate(${x},${y}) scale(${inv})`}>
                  <path className="meet-shadow" d="M0,2 L9,-14 A10,10 0 1 0 -9,-14 Z" />
                  <path className="meet" d="M0,0 L8,-15 A9,9 0 1 0 -8,-15 Z" />
                  <circle cx="0" cy="-17" r="4" className="meet-dot" />
                  <text y="14" textAnchor="middle" className="lbl meet-lbl">{meeting.label}</text>
                </g>
              );
            })()}

            {friends.map((p) => {
              const [x, y] = geoToSvg(t.affine, p.lng, p.lat);
              const where = p.sharing ? coarseLabel(t.stages, p.lng, p.lat) : "location off";
              return (
                <g key={p.id} transform={`translate(${x},${y}) scale(${inv})`} className={p.sharing ? "" : "off"}>
                  <circle r="7.5" className="friend" />
                  <text y="-12" textAnchor="middle" className="lbl name">{p.name}</text>
                  <text y="20" textAnchor="middle" className="lbl sub">{where}</text>
                </g>
              );
            })}

            {me && (() => {
              const [x, y] = geoToSvg(t.affine, me.lng, me.lat);
              return (
                <g transform={`translate(${x},${y}) scale(${inv})`}>
                  <circle className="me-acc pulse" r="9" />
                  <circle className="me" r="7" />
                  <text y="-13" textAnchor="middle" className="lbl name me-lbl">You</text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      <header className="topbar" ref={setTopEl}>
        <div className="title">
          <strong>{t.venue}</strong>
          <span>{t.stages.length} stages · live</span>
        </div>
        <div className="seg">
          {(["auto", "day", "night"] as const).map((m) => (
            <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
              {m[0]!.toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </header>

      <button className="recenter" onClick={recenter} title="Recenter">⤢</button>

      {openStage && (
        <section className="stage-sheet" role="dialog" aria-label={`${openStage.name} info`}>
          <header className="stage-sheet-head">
            <span className="stage-sheet-dot" style={{ background: stageColor(openStage.name) }} />
            <h3>{openStage.name}</h3>
            <button className="stage-sheet-close" aria-label="Close" onClick={() => setOpenStage(null)}>✕</button>
          </header>
          <div className="stage-sheet-now">
            {openProgramme?.now ? (
              <>
                <span className="pill pill-live">● now</span>
                <b>{openProgramme.now.label}</b>
                <em>{hhmm(openProgramme.now.startMs, timeZone)}–{hhmm(openProgramme.now.endMs, timeZone)}</em>
              </>
            ) : (
              <span className="muted">{openAtStage.length ? "Nothing on right now" : "No sets listed here"}</span>
            )}
          </div>
          {openProgramme?.next && (
            <div className="stage-sheet-next">
              <span className="label">Next</span>
              <b>{openProgramme.next.label}</b>
              <em>{hhmm(openProgramme.next.startMs, timeZone)}</em>
            </div>
          )}
        </section>
      )}

      <section className="friends-sheet" ref={setSheetEl}>
        <h3>Your group</h3>
        <ul>
          {me && <li className="me-row"><span className="dot me" /> <b>You</b><em>{coarseLabel(t.stages, me.lng, me.lat)}</em></li>}
          {friends.map((p) => (
            <li key={p.id} className={p.sharing ? "" : "muted"}>
              <span className={`dot ${p.sharing ? "friend" : "offdot"}`} /> <b>{p.name}</b>
              <em>{p.sharing ? coarseLabel(t.stages, p.lng, p.lat) : "location off"}</em>
            </li>
          ))}
        </ul>
        <p className="src">{t.source}</p>
      </section>
    </div>
  );
}
