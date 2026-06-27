/**
 * Set a meeting point — pick the spot (B4.1 / proto #26.1, UC-27). An exact opt-in spot the squad
 * walks to. The exact coordinate is the creator's explicit, intentional share (DEC-046) — the one
 * place exact coordinates leave the device in V1. Quick-pick (my spot / a stage) or tap the map to
 * drop a pin; the spot is auto-labelled by its nearest landmark. Photo is deferred (DEC-047, no R2).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useAppearance } from "../../app/settings";
import { coarseLabel, geoToSvg, svgToGeo, type MapTransform } from "../../map/transform";
import { mapBaseUrl } from "../../map/mapBase";
import { usePanZoom } from "../../map/usePanZoom";
import type { StageDto } from "../../data/types";
import { StagePickSheet } from "../presence/StagePickSheet";

/** Map assets are served statically for the live festival (DEC-040); single-festival in V1. */
const MAP_FID = "tomorrowland-deschorre";

export interface PickedSpot {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  label: string;
}

type Source = "pin" | "gps" | "stage";

export function MeetSpotScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { palette } = useAppearance();
  const [t, setT] = useState<MapTransform | null>(null);
  const [mapError, setMapError] = useState(false);
  const [lng, setLng] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [source, setSource] = useState<Source>("pin");
  const [locating, setLocating] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The shared `.base` raster fades in on load; without this flag it would stay invisible over the
  // warm viewport wash (which is the intended never-black fallback if the art never resolves).
  const [baseLoaded, setBaseLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/maps/${MAP_FID}-transform.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no map"))))
      .then((d: MapTransform) => alive && setT(d))
      .catch(() => alive && setMapError(true));
    return () => {
      alive = false;
    };
  }, []);

  // Start the pin at the venue centre so "Use this spot" is always actionable.
  useEffect(() => {
    if (!t || lng != null) return;
    const c = svgToGeo(t.affine, t.canvas.width / 2, t.canvas.height / 2);
    if (c) {
      setLng(c[0]);
      setLat(c[1]);
    }
  }, [t, lng]);

  const stages = useMemo<StageDto[]>(
    () =>
      (t?.stages ?? [])
        .filter((s) => s.matched)
        .map((s) => ({ id: s.name, sourceStageId: s.name, name: s.name, sortOrder: 0 })),
    [t]
  );
  const coordByName = useMemo(
    () => new Map((t?.stages ?? []).map((s) => [s.name, { lng: s.lng, lat: s.lat }])),
    [t]
  );

  // Reuse the fixed pan/zoom (R2.1): the picker is pannable + zoomable so a spot can be dropped
  // precisely (not just within the ~1000 px base). The base + markers share the transformed world.
  const cw = t?.canvas.width ?? 1000;
  const ch = t?.canvas.height ?? 1000;
  const { ref, view, handlers } = usePanZoom(cw, ch);
  // Tap-vs-pan: a release far from the press is a pan, not a pin drop.
  const downPt = useRef<{ x: number; y: number } | null>(null);

  const place = (nextLng: number, nextLat: number, acc: number | null, src: Source): void => {
    setLng(nextLng);
    setLat(nextLat);
    setAccuracy(acc);
    setSource(src);
  };

  const useMySpot = (): void => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        place(pos.coords.longitude, pos.coords.latitude, Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null, "gps");
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 }
    );
  };

  const pickStage = (stageName: string): void => {
    const c = coordByName.get(stageName);
    if (c) place(c.lng, c.lat, null, "stage");
    setSheetOpen(false);
  };

  const label = t && lng != null && lat != null ? coarseLabel(t.stages, lng, lat) : "Locating…";

  const useThisSpot = (): void => {
    if (lng == null || lat == null) return;
    const spot: PickedSpot = { lat, lng, accuracyMeters: accuracy, label };
    navigate(`/squad/${id}/meet/new`, { state: spot });
  };

  const pin = t && lng != null && lat != null ? geoToSvg(t.affine, lng, lat) : null;
  const base = mapBaseUrl(MAP_FID, palette);

  // World (canvas) point → on-screen px within the viewport, following the live pan/zoom transform.
  const screenOf = (wx: number, wy: number): { left: string; top: string } => ({
    left: `${view.x + wx * view.scale}px`,
    top: `${view.y + wy * view.scale}px`,
  });

  // Invert a client point back through the pan/zoom transform to a real coordinate.
  const geoFromClient = (clientX: number, clientY: number): [number, number] | null => {
    const el = ref.current;
    if (!el || !t) return null;
    const r = el.getBoundingClientRect();
    const wx = (clientX - r.left - view.x) / view.scale;
    const wy = (clientY - r.top - view.y) / view.scale;
    return svgToGeo(t.affine, wx, wy);
  };

  const onPickTap = (e: React.MouseEvent): void => {
    const d = downPt.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) >= 8) return; // it was a pan, not a tap
    const g = geoFromClient(e.clientX, e.clientY);
    if (g) place(g[0], g[1], null, "pin");
  };

  // "Drop pin" resets to the centre of what the user is currently looking at (venue centre at first fit).
  const dropAtCentre = (): void => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const g = geoFromClient(r.left + r.width / 2, r.top + r.height / 2);
    if (g) place(g[0], g[1], null, "pin");
  };

  return (
    <>
      <StackHeader title="Set a meeting point" backTo={`/squad`} />
      <div className="meet-spot-body">
        {mapError ? (
          <div className="meet-map-fallback glass">
            <span className="ms">map</span>
            <p>The festival map isn't available offline yet — use your current spot.</p>
          </div>
        ) : (
          <div
            className="meet-pick-viewport"
            ref={ref}
            style={{ aspectRatio: `${cw} / ${ch}` }}
            {...handlers}
            onPointerDownCapture={(e) => { downPt.current = { x: e.clientX, y: e.clientY }; }}
            onClick={onPickTap}
            role="application"
            aria-label="Drag to pan, pinch or scroll to zoom, tap to drop a meeting pin"
          >
            <div
              className="world"
              style={{ width: cw, height: ch, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            >
              <img
                className={`base${baseLoaded ? " is-loaded" : ""}`}
                src={base}
                width={cw}
                height={ch}
                alt="Festival map"
                draggable={false}
                onLoad={() => setBaseLoaded(true)}
                onError={() => setBaseLoaded(false)}
              />
            </div>
            {t?.stages
              .filter((s) => s.matched)
              .map((s) => {
                const [x, y] = geoToSvg(t.affine, s.lng, s.lat);
                return (
                  <span key={s.name} className="meet-stage-dot" style={screenOf(x, y)}>
                    <i />
                    {s.name}
                  </span>
                );
              })}
            {pin && (
              <>
                <span className="meet-ring" style={screenOf(pin[0], pin[1])} />
                <span className="meet-pin" style={screenOf(pin[0], pin[1])}>
                  <span className="ms">flag</span>
                </span>
              </>
            )}
          </div>
        )}

        <div className="meet-chips" onClick={(e) => e.stopPropagation()}>
          <button className={`chip${source === "pin" ? " on" : ""}`} onClick={dropAtCentre}>
            <span className="ms" style={{ fontSize: 15 }}>flag</span>
            Drop pin
          </button>
          <button className={`chip${source === "gps" ? " on" : ""}`} onClick={useMySpot} disabled={locating}>
            <span className="ms" style={{ fontSize: 15 }}>my_location</span>
            {locating ? "Locating…" : "My spot"}
          </button>
          <button
            className={`chip${source === "stage" ? " on" : ""}`}
            onClick={() => setSheetOpen(true)}
            disabled={stages.length === 0}
          >
            <span className="ms" style={{ fontSize: 15 }}>festival</span>
            A stage
          </button>
        </div>

        <div className="meet-spot-label glass" onClick={(e) => e.stopPropagation()}>
          <span className="ms" style={{ color: "var(--accent)" }}>place</span>
          <div className="meet-spot-label-main">{label}</div>
        </div>
      </div>

      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" onClick={useThisSpot} disabled={lng == null}>
          <span className="ms">arrow_forward</span>
          Use this spot
        </button>
      </div>

      {sheetOpen && (
        <StagePickSheet
          title="Meet at which stage?"
          stages={stages}
          busy={false}
          onPick={pickStage}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </>
  );
}
