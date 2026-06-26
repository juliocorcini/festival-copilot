/**
 * "I'm lost" / safety broadcast (Gate 6.3, proto #26.5/#26.6, UC-28, DEC-022). A calm, non-alarmist way
 * to get back to the squad. The menu (#26.5) offers: share my exact spot + alert the squad (the one
 * deliberate exact-coordinate share, DEC-046, reusing the meeting-point store with is_safety), find the
 * nearest landmark to walk toward (computed locally from the map — works with no help data), and a
 * medical/info/exit row (degrades honestly until POIs are mapped). Once broadcasting (#26.6): a steady
 * banner, the squad converging with live ETAs, and one tap to say "I'm okay" and stop sharing.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useSafety } from "../../data/meetingPoints";
import { useIdentity } from "../../data/identity";
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
  const { user } = useIdentity();
  const { points, status, reload } = useSafety(id);

  const [t, setT] = useState<MapTransform | null>(null);
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
      .then((d: MapTransform) => alive && setT(d))
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

  const landmark = t && fix ? coarseLabel(t.stages, fix.lng, fix.lat) : null;
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
        title: `${user?.displayName ?? "Someone"} needs help`,
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

  if (mine) {
    return <SafetyActive point={mine} landmark={landmark} busy={busy} onImOkay={() => imOkay(mine.id)} />;
  }

  return (
    <>
      <StackHeader title="I'm lost" backTo="/squad" />
      <div className="screen safety-menu">
        {others.map((p) => (
          <button key={p.id} className="glass safety-alert" onClick={() => navigate(`/squad/${id}/meet/${p.id}`)}>
            <span className="safety-alert-pulse">
              <span className="ms">sos</span>
            </span>
            <div className="safety-alert-main">
              <div className="safety-alert-title">{p.createdByName ?? "A squadmate"} needs help</div>
              <div className="safety-alert-sub">{p.landmarkLabel} · tap to go to them</div>
            </div>
            <span className="ms" style={{ color: "var(--accent)" }}>navigation</span>
          </button>
        ))}

        <div className="safety-reassure glass">
          <span className="ms">volunteer_activism</span>
          <div>
            <div className="safety-reassure-title">It happens to everyone</div>
            <div className="safety-reassure-sub">Take a breath — your squad can come to you.</div>
          </div>
        </div>

        <button className="safety-action primary" data-haptic="warning" onClick={triggerSafety} disabled={!fix || busy}>
          <span className="safety-action-icon">
            <span className="ms">share_location</span>
          </span>
          <div className="safety-action-main">
            <div className="safety-action-title">{busy ? "Alerting your squad…" : "Share my location + alert squad"}</div>
            <div className="safety-action-sub">
              {locating
                ? "Getting your location…"
                : fix
                ? "They'll see exactly where you are and come"
                : "Turn on location to share your exact spot"}
            </div>
          </div>
        </button>

        <button className="safety-action" onClick={() => setShowLandmark((v) => !v)}>
          <span className="safety-action-icon help">
            <span className="ms">my_location</span>
          </span>
          <div className="safety-action-main">
            <div className="safety-action-title">Find the nearest landmark</div>
            <div className="safety-action-sub">
              {showLandmark
                ? landmark
                  ? `You're ${landmark} — head there and describe it`
                  : "Turn on location to find a landmark"
                : "A big visible spot to walk to and describe"}
            </div>
          </div>
        </button>

        <div className="safety-action disabled">
          <span className="safety-action-icon danger">
            <span className="ms">medical_services</span>
          </span>
          <div className="safety-action-main">
            <div className="safety-action-title">Medical / info / exit</div>
            <div className="safety-action-sub">Help points aren't mapped for this festival yet</div>
          </div>
        </div>
      </div>
    </>
  );
}

/** Safety active (#26.6) — the steady broadcast: who's converging, with live ETAs, and "I'm okay". */
function SafetyActive({
  point,
  landmark,
  busy,
  onImOkay,
}: {
  point: MeetingPointDto;
  landmark: string | null;
  busy: boolean;
  onImOkay: () => void;
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
    <>
      <StackHeader title="" backTo="/squad" />
      <div className="screen safety-active">
        <div className="safety-banner">
          <span className="ms">share_location</span>
          <span>Squad alerted · your live location is shared</span>
        </div>

        <div className="safety-where glass">
          <span className="ms">my_location</span>
          <span>
            You're <b>{landmark ?? point.landmarkLabel}</b>
          </span>
        </div>

        <div className="label safety-coming-label">{onTheirWay ? "Your squad is on the way" : "Waiting for your squad to see this…"}</div>
        <div className="meet-roster safety-roster">
          {coming.length === 0 && <div className="safety-empty">Hang tight — they'll get the alert in a moment.</div>}
          {coming.map((m) => {
            const line = memberStatusLine(m);
            return (
              <div className={`meet-roster-row${line.tone === "muted" ? " muted" : ""}`} key={m.userId}>
                <PresenceAvatar name={m.displayName} color={m.avatarColor} size={32} />
                <span className="meet-roster-name">{m.displayName ?? "Guest"}</span>
                <span className={`meet-roster-status meet-status-${line.tone}`}>
                  {line.icon && <span className="ms" aria-hidden="true">{line.icon}</span>}
                  {line.text}
                </span>
              </div>
            );
          })}
        </div>

        <div className="safety-action disabled">
          <span className="safety-action-icon danger">
            <span className="ms">medical_services</span>
          </span>
          <div className="safety-action-main">
            <div className="safety-action-title">Nearest help point</div>
            <div className="safety-action-sub">Not mapped for this festival yet</div>
          </div>
        </div>

        <button className="btn btn-danger" onClick={onImOkay} disabled={busy}>
          <span className="ms" aria-hidden="true">location_off</span>
          {busy ? "Stopping…" : "I'm okay — stop sharing"}
        </button>
      </div>
    </>
  );
}
