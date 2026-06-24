/**
 * Set a meeting point — pick the spot (B4.1 / proto #26.1, UC-27). An exact opt-in spot the squad
 * walks to. The exact coordinate is the creator's explicit, intentional share (DEC-046) — the one
 * place exact coordinates leave the device in V1. Quick-pick (my spot / a stage) or tap the map to
 * drop a pin; the spot is auto-labelled by its nearest landmark. Photo is deferred (DEC-047, no R2).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useAppearance } from "../../app/settings";
import { coarseLabel, geoToSvg, svgToGeo, type MapTransform } from "../../map/transform";
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
  const cw = t?.canvas.width ?? 1000;
  const ch = t?.canvas.height ?? 1000;
  const base = `/maps/${MAP_FID}${palette === "day" ? "-day" : ""}.webp`;

  const onMapTap = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!t) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - rect.left) / rect.width;
    const fy = (e.clientY - rect.top) / rect.height;
    const g = svgToGeo(t.affine, fx * cw, fy * ch);
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
            className="meet-map"
            style={{ aspectRatio: `${cw} / ${ch}` }}
            onClick={onMapTap}
            role="application"
            aria-label="Tap to drop a meeting pin"
          >
            <img className="meet-map-base" src={base} width={cw} height={ch} alt="Festival map" draggable={false} />
            {t?.stages
              .filter((s) => s.matched)
              .map((s) => {
                const [x, y] = geoToSvg(t.affine, s.lng, s.lat);
                return (
                  <span
                    key={s.name}
                    className="meet-stage-dot"
                    style={{ left: `${(x / cw) * 100}%`, top: `${(y / ch) * 100}%` }}
                  >
                    <i />
                    {s.name}
                  </span>
                );
              })}
            {pin && (
              <>
                <span
                  className="meet-ring"
                  style={{ left: `${(pin[0] / cw) * 100}%`, top: `${(pin[1] / ch) * 100}%` }}
                />
                <span
                  className="meet-pin"
                  style={{ left: `${(pin[0] / cw) * 100}%`, top: `${(pin[1] / ch) * 100}%` }}
                >
                  <span className="ms">flag</span>
                </span>
              </>
            )}
          </div>
        )}

        <div className="meet-chips" onClick={(e) => e.stopPropagation()}>
          <button className={`chip${source === "pin" ? " on" : ""}`} onClick={() => t && place(...recentered(t), null, "pin")}>
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

/** Recenter helper for the "Drop pin" reset → returns [lng, lat] of the venue centre. */
function recentered(t: MapTransform): [number, number] {
  const c = svgToGeo(t.affine, t.canvas.width / 2, t.canvas.height / 2);
  return c ?? [0, 0];
}
