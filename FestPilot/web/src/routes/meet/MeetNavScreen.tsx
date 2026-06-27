/**
 * Meeting-point navigation — compass arrow + distance (Gate 6.3, UC-28). Deliberately NOT turn-by-turn:
 * inside a festival there are no streets, so a calm "it's that way, ~120 m" beats a routing engine. The
 * arrow points at the spot using the device heading (when granted) minus the bearing to the spot; with
 * no compass it falls back to a north-up arrow. Distance + walk ETA come from the live GPS fix. Every
 * piece degrades on its own so the screen is always useful (worst case: the landmark to walk toward).
 *
 * Two Gate-6.3 truths: (E13/DEC-100) if the point ends while you're navigating — e.g. the lost member
 * tapped "I'm okay" — we surface a calm resolved state instead of pointing forever at a ghost SOS; and
 * (E15/DEC-101) the compass is ALWAYS activatable, even once you've "arrived", via an explicit override.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useMeetingPoint } from "../../data/meetingPoints";
import { bearingDegrees, compassPoint, metersBetween } from "../../domain/travel";
import { useHeading, useMyFix } from "../../lib/useGeo";
import { useT } from "../../i18n";
import { ErrorState, LoadingState } from "../../ui/states";
import { formatMeters, navMode } from "./meetUi";

/** Same conservative walking model as the server (≈4 km/h × 1.3 detour) so the ETA matches the roster. */
function walkMinutes(meters: number): number {
  return Math.max(1, Math.round((meters * 1.3) / 67));
}

/** You're effectively at the spot inside this radius — switch the arrow for an "arrived" celebration. */
const ARRIVED_RADIUS_M = 15;

export function MeetNavScreen(): JSX.Element {
  const { id, mpId } = useParams<{ id: string; mpId: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { point, status } = useMeetingPoint(id, mpId);
  const { fix, denied } = useMyFix();
  const { heading, needsPermission, request } = useHeading();
  // E15: an explicit "show the compass" override so the dial is reachable even once you've arrived.
  const [forceCompass, setForceCompass] = useState(false);

  const target = point ? { lat: point.lat, lng: point.lng } : null;
  const distance = useMemo(() => (fix && target ? metersBetween(fix, target) : null), [fix, target]);
  const bearing = useMemo(() => (fix && target ? bearingDegrees(fix, target) : null), [fix, target]);
  const mode = navMode(distance, ARRIVED_RADIUS_M, forceCompass);
  // Arrow rotation: bearing relative to where the phone points (heading); north-up when no compass.
  const arrowDeg = bearing == null ? 0 : heading == null ? bearing : (bearing - heading + 360) % 360;

  if (status === "loading") return <LoadingState rows={3} />;
  if (!point) return <ErrorState title={t("meetnav.goneTitle")} message={t("meetnav.goneMsg")} />;

  // E13/DEC-100: the point resolved while we were navigating — clear the stuck "go to them" state.
  if (point.lifecycle === "cancelled" || point.lifecycle === "expired") {
    const name = point.createdByName ?? t("meetnav.yourSquadmate");
    return (
      <>
        <StackHeader title="" backTo="/squad" />
        <div className="screen nav-resolved">
          <div className="nav-resolved-orb">
            <span className="ms">{point.isSafety ? "verified_user" : "flag"}</span>
          </div>
          <h1 className="poster nav-resolved-title">
            {point.isSafety ? t("meetnav.resolvedSafeTitle") : t("meetnav.resolvedEndedTitle")}
          </h1>
          <p className="nav-resolved-sub">
            {point.isSafety ? t("meetnav.resolvedSafeBody", { name }) : t("meetnav.resolvedEndedBody")}
          </p>
          <button className="btn btn-primary" onClick={() => navigate("/squad")}>
            <span className="ms" aria-hidden="true">arrow_back</span>
            {t("meetnav.backToSquad")}
          </button>
        </div>
      </>
    );
  }

  const headerTitle = point.isSafety ? t("meetnav.goTo", { name: point.createdByName ?? t("meetnav.yourSquadmate") }) : point.title;

  return (
    <>
      <StackHeader title="" backTo={`/squad/${id}/meet/${mpId}`} />
      <div className="nav-screen">
        <div className="nav-target">
          <div className="nav-target-title">{headerTitle}</div>
          <div className="nav-target-sub">{point.landmarkLabel}</div>
        </div>

        {mode === "arrived" ? (
          <div className="nav-arrived">
            <div className="nav-arrived-orb">
              <span className="ms">where_to_vote</span>
            </div>
            <div className="poster nav-arrived-title">{t("meetnav.arrivedTitle")}</div>
            <div className="nav-arrived-sub">{t("meetnav.arrivedSub")}</div>
            {/* E15/DEC-101: even at the spot, you can still bring the compass back up. */}
            <button
              className="btn btn-ghost nav-show-compass"
              onClick={() => {
                setForceCompass(true);
                if (needsPermission) request();
              }}
            >
              <span className="ms" aria-hidden="true">explore</span>
              {t("meetnav.showCompass")}
            </button>
          </div>
        ) : (
          <div className="nav-compass" role="img" aria-label={bearing != null ? t("meetnav.spotDir", { dir: compassPoint(bearing) }) : t("meetnav.locating")}>
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
                    {t("meetnav.minWalk", { min: walkMinutes(distance) })}
                    {bearing != null ? ` · ${t("meetnav.head", { dir: compassPoint(bearing) })}` : ""}
                  </div>
                </>
              ) : (
                <div className="nav-eta">{denied ? t("meetnav.locationOff") : t("meetnav.locating")}</div>
              )}
            </div>
          </div>
        )}

        {denied && (
          <div className="nav-hint glass">
            <span className="ms" aria-hidden="true">location_off</span>
            <span>{t("meetnav.locationHint", { landmark: point.landmarkLabel })}</span>
          </div>
        )}
        {!denied && fix && heading == null && (
          needsPermission ? (
            <button className="btn btn-ghost nav-enable" onClick={request}>
              <span className="ms" aria-hidden="true">explore</span>
              {t("meetnav.enableCompass")}
            </button>
          ) : (
            <div className="nav-hint glass">
              <span className="ms" aria-hidden="true">explore</span>
              <span>{t("meetnav.noCompass", { dir: bearing != null ? compassPoint(bearing) : t("meetnav.theArrow") })}</span>
            </div>
          )
        )}

        <button className="btn btn-ghost nav-map" onClick={() => navigate("/map")}>
          <span className="ms" aria-hidden="true">map</span>
          {t("meetnav.openFullMap")}
        </button>
      </div>
    </>
  );
}
