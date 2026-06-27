/**
 * The georeferenced map view: the generated illustration (SVG → slim WebP base) as a pan/zoom
 * layer, with everything interactive drawn as a separate vector overlay placed through the exported
 * affine (DEC-030). Stages are crisp, screen-stable, tappable markers — never baked into the raster
 * (DEC-050) — and tapping one opens an info sheet (now-playing + next from the lineup). Day/night
 * palettes (DEC-034 §11.5) and coarse, privacy-safe labels (DEC-015).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router-dom";
import { geoToSvg, type MapTransform, type StageGeo } from "./transform";
import { useAppearance } from "../app/settings";
import { usePanZoom } from "./usePanZoom";
import { NO_INSETS, type Insets } from "./panClamp";
import { coarsePresencePins, isOutsideVenue } from "./presencePins";
import { useDeviceLocation } from "./useDeviceLocation";
import { poiMeta } from "./poiMeta";
import { useMyGroups } from "../data/groups";
import { useGroupPresence } from "../data/presence";
import { useLineup } from "../data/useLineup";
import { usePois } from "../data/usePois";
import type { PoiDto, PoiType } from "../data/types";
import { imageByActKey, toPlannableSets } from "../domain/lineup";
import { setsAtStage, stageProgrammeAt } from "../domain/stageProgramme";
import { PresenceAvatar, ago, presenceLine, sortRoster } from "../routes/presence/presenceUi";
import { stageColor, timeInZone } from "../lib/format";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";

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
const STAR = starPath(3.4, 1.5);
const hhmm = (ms: number, tz: string): string => timeInZone(new Date(ms).toISOString(), tz);

// Glass stage label geometry (DEC-076). The pill is sized in world px (it scales with the marker via
// `pinScale`, so it stays screen-stable). Oswald is condensed (~0.6em/char); the medallion gap + a
// right pad keep the name from ever clipping. Text sits to the right of the medallion at the origin.
const STAGE_LABEL_FS = 11;
const STAGE_LABEL_TEXT_X = 12;
const STAGE_LABEL_PILL_X = -3;
function stageLabelWidth(name: string): number {
  return STAGE_LABEL_TEXT_X - STAGE_LABEL_PILL_X + name.length * (STAGE_LABEL_FS * 0.6) + 8;
}

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
  const navigate = useNavigate();
  const [t, setT] = useState<MapTransform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { mode, setMode, palette } = useAppearance();
  const { lineup } = useLineup();

  // Real coarse presence (DEC-058): the active squad's roster — never invented friends. The map tab
  // isn't squad-scoped, so V1 follows the first squad (R9 adds a switcher); no squad ⇒ honest empty.
  const { groups } = useMyGroups();
  const activeGroup = groups[0] ?? null;
  const { presence } = useGroupPresence(activeGroup?.id);
  const roster = useMemo(() => sortRoster(presence?.members ?? []), [presence]);
  // Display-only device fix for the "you are here" dot + the out-of-venue decision (DEC-051).
  const device = useDeviceLocation();

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

  const sets = useMemo(
    () => (lineup ? toPlannableSets(lineup.performances, lineup.stages) : []),
    [lineup],
  );
  const photoByKey = useMemo(() => imageByActKey(lineup?.performances ?? []), [lineup]);
  const timeZone = lineup?.festival.timezone ?? "UTC";

  // Amenities (DEC-065): toilets/water/food/medical/exits dropped through the same affine as stages.
  // Keyed by the festival ULID like the travel matrix, so onboarded festivals show their POIs too.
  const pois = usePois(lineup?.festival.id);
  const poiTypesPresent = useMemo(() => {
    const seen = new Set<PoiType>();
    for (const p of pois) seen.add(p.type);
    return [...seen];
  }, [pois]);
  // Hidden types (filter chips toggle membership); empty = show every amenity.
  const [hiddenPoiTypes, setHiddenPoiTypes] = useState<Set<PoiType>>(() => new Set());
  const visiblePois = useMemo(() => pois.filter((p) => !hiddenPoiTypes.has(p.type)), [pois, hiddenPoiTypes]);
  const togglePoiType = (type: PoiType): void =>
    setHiddenPoiTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const [openStage, setOpenStage] = useState<StageGeo | null>(null);
  const [openPoi, setOpenPoi] = useState<PoiDto | null>(null);
  // Open on tap, but ignore the click that ends a pan-drag (release far from where it started).
  const downAt = useRef<{ x: number; y: number } | null>(null);
  const isTap = (e: React.MouseEvent): boolean => {
    const d = downAt.current;
    return !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8;
  };
  const markDown = (e: React.PointerEvent): void => {
    downAt.current = { x: e.clientX, y: e.clientY };
  };
  const stageTap = (s: StageGeo) => ({
    onPointerDown: markDown,
    onClick: (e: React.MouseEvent) => {
      if (isTap(e)) {
        setOpenPoi(null);
        setOpenStage(s);
      }
    },
  });
  const poiTap = (p: PoiDto) => ({
    onPointerDown: markDown,
    onClick: (e: React.MouseEvent) => {
      if (isTap(e)) {
        setOpenStage(null);
        setOpenPoi(p);
      }
    },
  });

  const inv = 1 / view.scale; // keep markers a constant screen size at any zoom
  const pinScale = Math.min(inv, 1.6); // …but don't let them balloon when zoomed all the way out

  if (error) return <div className="map-msg">Could not load the map: {error}</div>;
  if (!t) return <div className="map-msg">Loading map…</div>;

  // Slim pre-rendered raster base (DEC-040), now label-free (DEC-050); the interactive layer below
  // is a separate vector overlay so stage names/markers stay crisp and tappable at any zoom.
  const base = `/maps/${festivalId}${palette === "day" ? "-day" : ""}.webp`;
  const openProgramme = openStage ? stageProgrammeAt(sets, openStage.name, nowMs) : null;
  const openAtStage = openStage ? setsAtStage(sets, openStage.name) : [];

  // Out-of-venue (DEC-051): a device fix beyond the bbox can't sit on the art → show an honest state
  // and a "show festival map" button instead of a black void; only then is "me" a precise dot.
  const outside = device.coords ? isOutsideVenue(t.bbox, device.coords.lng, device.coords.lat) : false;
  const hasPreciseMe = !!device.coords && !outside;
  // Coarse, stage-anchored squad pins — never a raw coordinate. Drop "you" when the precise dot is shown.
  const pins = coarsePresencePins(t, hasPreciseMe ? roster.filter((m) => !m.isYou) : roster);

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
            {visiblePois.map((p) => {
              const [x, y] = geoToSvg(t.affine, p.lng, p.lat);
              const meta = poiMeta(p.type);
              const selected = openPoi?.id === p.id;
              return (
                <g
                  key={p.id}
                  className={`poi-pin${selected ? " is-open" : ""}`}
                  transform={`translate(${x},${y}) scale(${pinScale})`}
                  role="button"
                  aria-label={p.name ? `${meta.label}: ${p.name}` : meta.label}
                  {...poiTap(p)}
                >
                  <ellipse className="poi-pin-shadow" cx="0" cy="2.6" rx="4.4" ry="1.6" />
                  <circle className="poi-pin-disc" r="5.2" style={{ fill: meta.color }} />
                  <text className="poi-pin-glyph" y="2.1" textAnchor="middle">{meta.glyph}</text>
                </g>
              );
            })}

            {t.stages.map((s) => {
              const [x, y] = geoToSvg(t.affine, s.lng, s.lat);
              const live = stageProgrammeAt(sets, s.name, nowMs).now;
              const selected = openStage?.name === s.name;
              const color = stageColor(s.name);
              return (
                <g
                  key={s.name}
                  className={`stage-pin${selected ? " is-open" : ""}${live ? " is-live" : ""}`}
                  transform={`translate(${x},${y}) scale(${pinScale})`}
                  role="button"
                  aria-label={`${s.name}${live ? `, now playing ${live.label}` : ""}`}
                  {...stageTap(s)}
                >
                  {/* Amber-Glass label pill, tucked behind the medallion (DEC-076): translucent warm
                      base + amber hairline, legible name — never pure black text on the art. */}
                  <rect
                    className="stage-label-bg"
                    x={STAGE_LABEL_PILL_X}
                    y="-7.5"
                    width={stageLabelWidth(s.name)}
                    height="15"
                    rx="7.5"
                  />
                  <text className="stage-label-text" x={STAGE_LABEL_TEXT_X} y="3.3">{s.name}</text>
                  {/* Clean medallion: soft shadow, glass ring, stage-colour disc, small star. */}
                  <ellipse className="stage-pin-shadow" cx="0" cy="3.4" rx="6.6" ry="2.3" />
                  <circle className="stage-pin-ring" r="7.4" />
                  <circle className="stage-pin-disc" r="6" style={{ fill: color }} />
                  <path className="stage-pin-star" d={STAR} />
                  {live && <circle className="stage-pin-live" cx="5.9" cy="-5.9" r="2.6" />}
                </g>
              );
            })}

            {pins.map((p) => (
              <g
                key={p.id}
                transform={`translate(${p.x},${p.y}) scale(${pinScale})`}
                className={`pres-pin${p.live ? " is-live" : ""}${p.isYou ? " is-you" : ""}`}
              >
                {p.live && <circle className="pres-ring pulse" r="9" />}
                <circle className="pres-disc" r="8.5" style={{ fill: p.color }} />
                <text className="pres-initials" y="3" textAnchor="middle" style={{ fill: p.darkText ? "#0F0D09" : "#fff" }}>
                  {p.initials}
                </text>
                <text className="lbl name pres-name" y="-12" textAnchor="middle">{p.name}</text>
              </g>
            ))}

            {hasPreciseMe && (() => {
              const [x, y] = geoToSvg(t.affine, device.coords!.lng, device.coords!.lat);
              return (
                <g transform={`translate(${x},${y}) scale(${pinScale})`}>
                  <circle className="me-acc pulse" r="9" />
                  <circle className="me" r="6.5" />
                  <text y="-12" textAnchor="middle" className="lbl name me-lbl">You</text>
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

      {poiTypesPresent.length > 0 && (
        <div className="poi-legend" role="group" aria-label="Map amenities">
          {poiTypesPresent.map((type) => {
            const meta = poiMeta(type);
            const off = hiddenPoiTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                className={`poi-chip${off ? " is-off" : ""}`}
                aria-pressed={!off}
                onClick={() => togglePoiType(type)}
              >
                <span aria-hidden="true">{meta.glyph}</span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}

      {outside && (
        <div className="map-outside glass" role="status">
          <span className="ms" aria-hidden="true">location_off</span>
          <div className="map-outside-main">
            <strong>You're outside the festival</strong>
            <span>Precise location works inside the venue.</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={recenter}>Show festival map</button>
        </div>
      )}

      {openPoi && (() => {
        const meta = poiMeta(openPoi.type);
        return (
          <section className="stage-sheet poi-sheet" role="dialog" aria-label={`${meta.label} info`}>
            <header className="stage-sheet-head">
              <span className="poi-sheet-glyph" style={{ background: meta.color }} aria-hidden="true">{meta.glyph}</span>
              <h3>{openPoi.name ?? meta.label}</h3>
              <button className="stage-sheet-close" aria-label="Close" onClick={() => setOpenPoi(null)}>✕</button>
            </header>
            <div className="poi-sheet-body">
              <span className="pill">{meta.label}</span>
              {openPoi.verified && <span className="pill ok">✓ verified</span>}
            </div>
          </section>
        );
      })()}

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
                <ArtistPhoto
                  src={photoByKey.get(openProgramme.now.actKey) ?? null}
                  name={openProgramme.now.label}
                  width={PHOTO_WIDTH.list}
                  className="stage-sheet-photo"
                />
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
              <ArtistPhoto
                src={photoByKey.get(openProgramme.next.actKey) ?? null}
                name={openProgramme.next.label}
                width={PHOTO_WIDTH.avatar}
                className="stage-sheet-photo sm"
              />
              <span className="label">Next</span>
              <b>{openProgramme.next.label}</b>
              <em>{hhmm(openProgramme.next.startMs, timeZone)}</em>
            </div>
          )}
        </section>
      )}

      <section className="friends-sheet" ref={setSheetEl}>
        <h3>{activeGroup?.name ?? "Your squad"}</h3>
        {!activeGroup ? (
          <div className="map-empty">
            <p>Join a squad to see where everyone is.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/squad")}>Find your squad</button>
          </div>
        ) : roster.length === 0 ? (
          <div className="map-empty"><p>No one's sharing their location yet.</p></div>
        ) : (
          <ul className="map-roster">
            {roster.map((m) => {
              const line = presenceLine(m);
              return (
                <li key={m.userId} className={line.muted ? "muted" : ""}>
                  <PresenceAvatar name={m.displayName} color={m.avatarColor} live={m.live} size={32} />
                  <div className="map-roster-main">
                    <b>{m.displayName ?? "Guest"}{m.isYou && <span className="you"> · you</span>}</b>
                    <span className="map-roster-line">{line.text}{line.sub ? ` · ${line.sub}` : ""}</span>
                  </div>
                  {!line.muted && m.presence && <em>{ago(m.presence.ageSeconds)}</em>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="src">{t.source}</p>
      </section>
    </div>
  );
}
