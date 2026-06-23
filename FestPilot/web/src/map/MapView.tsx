/**
 * The georeferenced map view: the generated illustration (SVG) as a pan/zoom base,
 * with a live presence overlay placed through the exported affine (DEC-030).
 * Day/night palettes (DEC-034 §11.5) and coarse, privacy-safe labels (DEC-015).
 */
import { useEffect, useMemo, useState } from "react";
import { coarseLabel, geoToSvg, type MapTransform } from "./transform";
import { usePalette } from "./usePalette";
import { usePanZoom } from "./usePanZoom";
import { usePresence } from "./presence";

interface Props {
  festivalId?: string;
}

export function MapView({ festivalId = "tomorrowland-deschorre" }: Props): JSX.Element {
  const [t, setT] = useState<MapTransform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode, setMode, palette } = usePalette();

  useEffect(() => {
    let alive = true;
    fetch(`/maps/${festivalId}-transform.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`map ${festivalId} not found`))))
      .then((data: MapTransform) => alive && setT(data))
      .catch((e) => alive && setError(String(e.message ?? e)));
    return () => { alive = false; };
  }, [festivalId]);

  const cw = t?.canvas.width ?? 1000;
  const ch = t?.canvas.height ?? 1000;
  const { ref, view, recenter, handlers } = usePanZoom(cw, ch);
  const { people, meeting } = usePresence(t?.stages ?? []);

  const inv = 1 / view.scale; // keep markers a constant screen size at any zoom

  const friends = useMemo(() => people.filter((p) => p.kind === "friend"), [people]);
  const me = people.find((p) => p.kind === "me") ?? null;

  if (error) return <div className="map-msg">Could not load the map: {error}</div>;
  if (!t) return <div className="map-msg">Loading map…</div>;

  const base = `/maps/${festivalId}${palette === "day" ? "-day" : ""}.svg`;

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

      <header className="topbar">
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

      <section className="friends-sheet">
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
