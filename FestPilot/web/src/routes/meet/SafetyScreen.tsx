/**
 * "I'm lost" / safety broadcast (Gate 6.3, proto #26.5/#26.6, UC-28, DEC-022). A calm, non-alarmist way
 * to get back to the squad. The menu (#26.5) offers: share my exact spot + alert the squad (the one
 * deliberate exact-coordinate share, DEC-046, reusing the meeting-point store with is_safety), find the
 * nearest landmark to walk toward (computed locally from the map — works with no help data), and a
 * medical/info/exit row (degrades honestly until POIs are mapped). Once broadcasting (#26.6): a steady
 * banner, the squad converging with live ETAs, and one tap to say "I'm okay" and stop sharing.
 *
 * Mutual awareness (Gate 6.3, E12/DEC-100): broadcasting yourself NO LONGER hides everyone else — if
 * two people are lost at once, each still sees the other's alert and can navigate to them. Stopping
 * fans out so the resolved state clears on every device (the lane is "active-only", server-side).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useSafety } from "../../data/meetingPoints";
import { useIdentity } from "../../data/identity";
import { useT, type TranslateFn } from "../../i18n";
import { coarseLabel, type MapTransform } from "../../map/transform";
import type { MeetingPointDto, MeetingPointMemberDto } from "../../data/types";
import { LoadingState } from "../../ui/states";
import { PresenceAvatar } from "../presence/presenceUi";
import { memberStatusLine } from "./meetUi";

const MAP_FID = "tomorrowland-deschorre";

/** Converging roster order: arrived first, then heading over by soonest ETA, then the rest. */
const STATUS_RANK: Record<MeetingPointMemberDto["status"], number> = {
  arrived: 0,
  going: 1,
  no_response: 2,
  left: 3,
  not_going: 3,
};

interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export function SafetyScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
  const { user } = useIdentity();
  const { points, status, reload } = useSafety(id);

  const [transform, setTransform] = useState<MapTransform | null>(null);
  const [fix, setFix] = useState<Fix | null>(null);
  const [locating, setLocating] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showLandmark, setShowLandmark] = useState(false);
  const acquired = useRef(false);

  // The map transform powers the local "nearest landmark" label (no help data needed).
  useEffect(() => {
    let alive = true;
    fetch(`/maps/${MAP_FID}-transform.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no map"))))
      .then((d: MapTransform) => alive && setTransform(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // One fresh fix on open so "Share + alert" is instantly actionable.
  useEffect(() => {
    if (acquired.current || !navigator.geolocation) {
      setLocating(false);
      return;
    }
    acquired.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFix({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
  }, []);

  const landmark = transform && fix ? coarseLabel(transform.stages, fix.lng, fix.lat) : null;
  const mine = useMemo(() => points.find((p) => p.isMine) ?? null, [points]);
  const others = useMemo(() => points.filter((p) => !p.isMine), [points]);

  const triggerSafety = async (): Promise<void> => {
    if (!id || !fix || busy) return;
    setBusy(true);
    try {
      await api.createMeetingPoint(id, {
        lat: fix.lat,
        lng: fix.lng,
        accuracyMeters: fix.accuracy,
        title: t("safety.needsHelpTitle", { name: user?.displayName ?? t("safety.someone") }),
        isSafety: true,
      });
      reload();
    } catch {
      /* the tick + socket reconcile; the button re-enables */
    }
    setBusy(false);
  };

  const imOkay = async (pid: string): Promise<void> => {
    if (!id || busy) return;
    setBusy(true);
    try {
      await api.endMeetingPoint(id, pid, "close");
      reload();
    } catch {
      /* reconcile on next tick */
    }
    setBusy(false);
  };

  if (status === "loading") return <LoadingState rows={3} />;

  const openAlert = (p: MeetingPointDto): void => navigate(`/squad/${id}/meet/${p.id}`);

  return (
    <>
      <StackHeader title={t("safety.title")} backTo="/squad" />
      <div className="screen safety-menu">
        {mine && (
          <SafetyActiveCard
            point={mine}
            landmark={landmark}
            busy={busy}
            hasOthers={others.length > 0}
            onImOkay={() => imOkay(mine.id)}
            t={t}
          />
        )}

        {others.length > 0 && mine && <div className="label safety-others-label">{t("safety.othersLooking")}</div>}
        {others.map((p) => (
          <SafetyOtherAlert key={p.id} point={p} t={t} onOpen={() => openAlert(p)} />
        ))}

        {/* The trigger UI is only for when I'm NOT already broadcasting. */}
        {!mine && (
          <>
            <div className="safety-reassure glass">
              <span className="ms">volunteer_activism</span>
              <div>
                <div className="safety-reassure-title">{t("safety.reassureTitle")}</div>
                <div className="safety-reassure-sub">{t("safety.reassureSub")}</div>
              </div>
            </div>

            <button className="safety-action primary" data-haptic="warning" onClick={triggerSafety} disabled={!fix || busy}>
              <span className="safety-action-icon">
                <span className="ms">share_location</span>
              </span>
              <div className="safety-action-main">
                <div className="safety-action-title">{busy ? t("safety.alerting") : t("safety.shareAlert")}</div>
                <div className="safety-action-sub">
                  {locating ? t("safety.gettingLocation") : fix ? t("safety.shareAlertSub") : t("safety.turnOnToShare")}
                </div>
              </div>
            </button>

            <button className="safety-action" onClick={() => setShowLandmark((v) => !v)}>
              <span className="safety-action-icon help">
                <span className="ms">my_location</span>
              </span>
              <div className="safety-action-main">
                <div className="safety-action-title">{t("safety.findLandmark")}</div>
                <div className="safety-action-sub">
                  {showLandmark
                    ? landmark
                      ? t("safety.youreAtLandmark", { landmark })
                      : t("safety.turnOnForLandmark")
                    : t("safety.landmarkSub")}
                </div>
              </div>
            </button>

            <div className="safety-action disabled">
              <span className="safety-action-icon danger">
                <span className="ms">medical_services</span>
              </span>
              <div className="safety-action-main">
                <div className="safety-action-title">{t("safety.medical")}</div>
                <div className="safety-action-sub">{t("safety.medicalNotMapped")}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

/** Another squadmate's active SOS — tappable to navigate to them (mutual awareness, E12). */
function SafetyOtherAlert({ point, t, onOpen }: { point: MeetingPointDto; t: TranslateFn; onOpen: () => void }): JSX.Element {
  return (
    <button className="glass safety-alert" onClick={onOpen}>
      <span className="safety-alert-pulse">
        <span className="ms">sos</span>
      </span>
      <div className="safety-alert-main">
        <div className="safety-alert-title">{t("squad.needsHelp", { name: point.createdByName ?? t("squad.aSquadmate") })}</div>
        <div className="safety-alert-sub">
          {point.landmarkLabel} · {t("safety.tapToGo")}
        </div>
      </div>
      <span className="ms" style={{ color: "var(--accent)" }}>navigation</span>
    </button>
  );
}

/** My active broadcast (#26.6) — the steady "squad is coming" state, with who's converging + "I'm okay". */
function SafetyActiveCard({
  point,
  landmark,
  busy,
  hasOthers,
  onImOkay,
  t,
}: {
  point: MeetingPointDto;
  landmark: string | null;
  busy: boolean;
  hasOthers: boolean;
  onImOkay: () => void;
  t: TranslateFn;
}): JSX.Element {
  const coming = useMemo(
    () =>
      point.members
        .filter((m) => !m.isYou)
        .sort((a, b) => {
          const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
          if (r !== 0) return r;
          return (a.etaMinutes ?? Number.POSITIVE_INFINITY) - (b.etaMinutes ?? Number.POSITIVE_INFINITY);
        }),
    [point.members]
  );
  const onTheirWay = coming.some((m) => m.status === "going" || m.status === "arrived");

  return (
    <div className="safety-active-card">
      <div className="safety-banner">
        <span className="ms">share_location</span>
        <span>{t("safety.alertedBanner")}</span>
      </div>

      <div className="safety-where glass">
        <span className="ms">my_location</span>
        <span>
          {t("safety.youreAt")} <b>{landmark ?? point.landmarkLabel}</b>
        </span>
      </div>

      <div className="label safety-coming-label">{onTheirWay ? t("safety.squadOnWay") : t("safety.waitingSquad")}</div>
      <div className="meet-roster safety-roster">
        {coming.length === 0 && <div className="safety-empty">{t("safety.hangTight")}</div>}
        {coming.map((m) => {
          const line = memberStatusLine(m);
          return (
            <div className={`meet-roster-row${line.tone === "muted" ? " muted" : ""}`} key={m.userId}>
              <PresenceAvatar name={m.displayName} color={m.avatarColor} size={32} />
              <span className="meet-roster-name">{m.displayName ?? t("common.guest")}</span>
              <span className={`meet-roster-status meet-status-${line.tone}`}>
                {line.icon && <span className="ms" aria-hidden="true">{line.icon}</span>}
                {line.text}
              </span>
            </div>
          );
        })}
      </div>

      <button className="btn btn-danger" onClick={onImOkay} disabled={busy}>
        <span className="ms" aria-hidden="true">location_off</span>
        {busy ? t("safety.stopping") : t("safety.imOkay")}
      </button>
      {hasOthers && <div className="safety-also-hint">{t("safety.alsoHelpOthers")}</div>}
    </div>
  );
}
