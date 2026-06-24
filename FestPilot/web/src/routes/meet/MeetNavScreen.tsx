/**
 * Meeting-point navigation — compass arrow + distance (Gate 6.3, UC-28). Deliberately NOT turn-by-turn:
 * inside a festival there are no streets, so a calm "it's that way, ~120 m" beats a routing engine. The
 * arrow points at the spot using the device heading (when granted) minus the bearing to the spot; with
 * no compass it falls back to a north-up arrow. Distance + walk ETA come from the live GPS fix. Every
 * piece degrades on its own so the screen is always useful (worst case: the landmark to walk toward).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useMeetingPoint } from "../../data/meetingPoints";
import { bearingDegrees, compassPoint, metersBetween } from "../../domain/travel";
import { ErrorState, LoadingState } from "../../ui/states";
import { formatMeters } from "./meetUi";

/** Same conservative walking model as the server (≈4 km/h × 1.3 detour) so the ETA matches the roster. */
function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.3) / 67));
}

/** You're effectively at the spot inside this radius — switch the arrow for an "arrived" celebration. */
const ARRIVED_RADIUS_M = 15;

interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
}

/** Live device heading (degrees clockwise from north), best-effort across iOS/Android with graceful gaps. */
function useHeading(): { heading: number | null; needsPermission: boolean; request: () => void } {
  const [heading, setHeading] = useState<number | null>(null);
  const [granted, setGranted] = useState(false);
  const needsPermission =
    typeof window !== "undefined" &&
    typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown })?.requestPermission ===
      "function";

  useEffect(() => {
    if (needsPermission && !granted) return;
    const onOrient = (e: DeviceOrientationEvent): void => {
      const webkit = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof webkit === "number" && !Number.isNaN(webkit)) setHeading(webkit);
      else if (e.absolute && e.alpha != null) setHeading((360 - e.alpha) % 360);
    };
    window.addEventListener("deviceorientationabsolute", onOrient as EventListener);
    window.addEventListener("deviceorientation", onOrient as EventListener);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener);
      window.removeEventListener("deviceorientation", onOrient as EventListener);
    };
  }, [needsPermission, granted]);

  const request = (): void => {
    const req = (window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
      ?.requestPermission;
    if (typeof req === "function") req().then((r) => r === "granted" && setGranted(true)).catch(() => {});
    else setGranted(true);
  };

  return { heading, needsPermission, request };
}

/** Live GPS fix while the screen is open (watchPosition); null until the first fix / when denied. */
function useMyFix(): { fix: Fix | null; denied: boolean } {
  const [fix, setFix] = useState<Fix | null>(null);
  const [denied, setDenied] = useState(false);
  const watch = useRef<number | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setDenied(true);
      return;
    }
    watch.current = navigator.geolocation.watchPosition(
      (pos) =>
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        }),
      () => setDenied(true),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    return () => {
      if (watch.current != null) navigator.geolocation.clearWatch(watch.current);
    };
  }, []);

  return { fix, denied };
}

export function MeetNavScreen(): JSX.Element {
  const { id, mpId } = useParams<{ id: string; mpId: string }>();
  const navigate = useNavigate();
  const { point, status } = useMeetingPoint(id, mpId);
  const { fix, denied } = useMyFix();
  const { heading, needsPermission, request } = useHeading();

  const target = point ? { lat: point.lat, lng: point.lng } : null;
  const distance = useMemo(() => (fix && target ? metersBetween(fix, target) : null), [fix, target]);
  const bearing = useMemo(() => (fix && target ? bearingDegrees(fix, target) : null), [fix, target]);
  const arrived = distance != null && distance <= ARRIVED_RADIUS_M;
  // Arrow rotation: bearing relative to where the phone points (heading); north-up when no compass.
  const arrowDeg = bearing == null ? 0 : heading == null ? bearing : (bearing - heading + 360) % 360;

  if (status === "loading") return <LoadingState rows={3} />;
  if (!point) return <ErrorState title="This spot is gone" message="It may have ended or been called off." />;

  const headerTitle = point.isSafety ? `Go to ${point.createdByName ?? "your squadmate"}` : point.title;

  return (
    <>
      <StackHeader title="" backTo={`/squad/${id}/meet/${mpId}`} />
      <div className="nav-screen">
        <div className="nav-target">
          <div className="nav-target-title">{headerTitle}</div>
          <div className="nav-target-sub">{point.landmarkLabel}</div>
        </div>

        {arrived ? (
          <div className="nav-arrived">
            <div className="nav-arrived-orb">
              <span className="ms">where_to_vote</span>
            </div>
            <div className="poster nav-arrived-title">You're here</div>
            <div className="nav-arrived-sub">You're right at the spot — look up.</div>
          </div>
        ) : (
          <div className="nav-compass" role="img" aria-label={bearing != null ? `Spot is ${compassPoint(bearing)} of you` : "Locating"}>
            <div className="nav-dial">
              {["N", "E", "S", "W"].map((c, i) => (
                <span key={c} className="nav-card" style={{ transform: `rotate(${i * 90}deg)` }}>
                  <i style={{ transform: `rotate(${-i * 90}deg)` }}>{c}</i>
                </span>
              ))}
              <div className={`nav-arrow${bearing == null ? " pending" : ""}`} style={{ transform: `rotate(${arrowDeg}deg)` }}>
                <span className="ms">navigation</span>
              </div>
            </div>
            <div className="nav-readout">
              {distance != null ? (
                <>
                  <div className="nav-distance">{formatMeters(Math.round(distance))}</div>
                  <div className="nav-eta">
                    ~{walkMinutes(distance)} min walk{bearing != null ? ` · head ${compassPoint(bearing)}` : ""}
                  </div>
                </>
              ) : (
                <div className="nav-eta">{denied ? "Location off" : "Locating you…"}</div>
              )}
            </div>
          </div>
        )}

        {denied && (
          <div className="nav-hint glass">
            <span className="ms" aria-hidden="true">location_off</span>
            <span>Turn on location to see the arrow. Until then, head for <b>{point.landmarkLabel}</b>.</span>
          </div>
        )}
        {!denied && fix && heading == null && (
          needsPermission ? (
            <button className="btn btn-ghost nav-enable" onClick={request}>
              <span className="ms" aria-hidden="true">explore</span>
              Enable compass
            </button>
          ) : (
            <div className="nav-hint glass">
              <span className="ms" aria-hidden="true">explore</span>
              <span>No compass on this device — the arrow points <b>north-up</b>. Hold your phone flat and face {bearing != null ? compassPoint(bearing) : "the arrow"}.</span>
            </div>
          )
        )}

        <button className="btn btn-ghost nav-map" onClick={() => navigate("/map")}>
          <span className="ms" aria-hidden="true">map</span>
          Open the full map
        </button>
      </div>
    </>
  );
}
