/**
 * Meeting point — detail + lifecycle (B4.3/B4.4, proto #26.3/#26.4, UC-27/28). The convergence view:
 * a map with the exact spot + the squad converging on it, a roster with live ETAs / here / no-response,
 * and the going/here/can't loop. When everyone arrives it becomes the reunion moment (#26.4); a
 * creator can close it or call it off. Lifecycle is derived server-side, so this screen just renders it.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useMeetingPoint } from "../../data/meetingPoints";
import { useGroupPresence } from "../../data/presence";
import { initialsOf } from "../../data/identity";
import type { MeetingPointMemberDto, SettableMeetingStatus } from "../../data/types";
import { ErrorState, LoadingState } from "../../ui/states";
import { PresenceAvatar } from "../presence/presenceUi";
import { MeetConvergenceMap } from "./MeetConvergenceMap";
import { closesInLabel, convergenceSummary, lifecycleBadge, memberStatusLine, whenLabel } from "./meetUi";

/** Roster order: here first, then heading over (soonest ETA), then no-response, then can't. */
const STATUS_RANK: Record<MeetingPointMemberDto["status"], number> = {
  arrived: 0,
  going: 1,
  no_response: 2,
  left: 3,
  not_going: 3,
};

export function MeetDetailScreen(): JSX.Element {
  const { id, mpId } = useParams<{ id: string; mpId: string }>();
  const navigate = useNavigate();
  const { point, status, reload } = useMeetingPoint(id, mpId);
  const { presence } = useGroupPresence(id);
  const [busy, setBusy] = useState<string | null>(null);
  const [keptOpen, setKeptOpen] = useState(false);

  const roster = useMemo(() => {
    const members = point?.members ?? [];
    return [...members].sort((a, b) => {
      const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (r !== 0) return r;
      return (a.etaMinutes ?? Number.POSITIVE_INFINITY) - (b.etaMinutes ?? Number.POSITIVE_INFINITY);
    });
  }, [point]);

  const setStatus = async (next: SettableMeetingStatus): Promise<void> => {
    if (!id || !mpId || busy) return;
    setBusy(next);
    try {
      await api.setMeetingStatus(id, mpId, next);
      reload();
    } catch {
      /* the tick + socket will reconcile */
    }
    setBusy(null);
  };

  const end = async (mode: "close" | "cancel"): Promise<void> => {
    if (!id || !mpId || busy) return;
    setBusy(mode);
    try {
      await api.endMeetingPoint(id, mpId, mode);
      navigate("/squad", { replace: true });
    } catch {
      setBusy(null);
    }
  };

  if (status === "loading" && !point) return <LoadingState rows={4} />;
  if (status === "error" && !point) return <ErrorState message="Couldn't load this meeting point." onRetry={reload} />;
  if (!point) return <EndedState title="Meeting point" body="This meeting point is no longer active." />;

  // #26.4 — terminal states.
  if (point.lifecycle === "cancelled")
    return <EndedState title={point.title} body="The meeting point was called off." icon="cancel" tone="danger" />;
  if (point.lifecycle === "expired")
    return <EndedState title={point.title} body="This meeting point has closed." icon="timer_off" />;

  // #26.4 — the reunion moment (until the creator closes it or anyone chooses "keep open").
  if (point.everyoneHere && !keptOpen) {
    return (
      <>
        <StackHeader title="" backTo="/squad" />
        <div className="screen meet-reunion">
          <div className="meet-reunion-orb">
            <span className="ms">celebration</span>
          </div>
          <h1 className="poster meet-reunion-title">The squad's back together</h1>
          <p className="meet-reunion-sub">
            Everyone made it to <b>{point.title}</b>.
          </p>
          <div className="meet-reunion-stack">
            {point.members
              .filter((m) => m.status === "arrived")
              .map((m) => (
                <span
                  key={m.userId}
                  className="ava"
                  style={{
                    background: m.avatarColor
                      ? `linear-gradient(135deg, ${m.avatarColor}, ${m.avatarColor}cc)`
                      : "linear-gradient(135deg, #6B7280, #6B7280cc)",
                    color: "#0F0D09",
                  }}
                >
                  {initialsOf(m.displayName)}
                </span>
              ))}
          </div>
        </div>
        <div className="squad-actions" style={{ marginTop: "auto" }}>
          {point.isMine ? (
            <>
              <button className="btn btn-ghost" onClick={() => setKeptOpen(true)}>
                Keep open
              </button>
              <button className="btn btn-primary" onClick={() => end("close")} disabled={busy !== null}>
                {busy === "close" ? "Closing…" : "Close point"}
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setKeptOpen(true)}>
              View the spot
            </button>
          )}
        </div>
      </>
    );
  }

  // #26.3 — active convergence detail.
  const badge = lifecycleBadge(point.lifecycle);
  const closes = closesInLabel(point.expiresAtUtc);
  const subtitle = [point.landmarkLabel, whenLabel(point.meetAtUtc), point.note ? `"${point.note}"` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <StackHeader title="" backTo="/squad" />
      <div className="meet-detail">
        <MeetConvergenceMap
          lat={point.lat}
          lng={point.lng}
          members={presence?.members ?? []}
          onOpen={() => navigate("/map")}
        />

        <div className="meet-detail-sheet glass">
          <div className="meet-detail-head">
            <div className="meet-detail-titles">
              <div className="poster meet-detail-title">{point.title}</div>
              <div className="meet-detail-sub">{subtitle}</div>
            </div>
            <span className={`pill meet-badge meet-badge-${badge.tone}`}>{badge.label}</span>
          </div>

          {point.isMine && point.creatorDrifted && (
            <div className="meet-drift">
              <span className="ms" aria-hidden="true">explore_off</span>
              <span>You've wandered from the spot — </span>
              <button className="meet-drift-link" onClick={() => navigate(`/squad/${id}/meet`)}>
                set a new one
              </button>
            </div>
          )}
          {point.lifecycle === "expiring_soon" && closes && (
            <div className="meet-closing">
              <span className="ms" aria-hidden="true">timelapse</span>
              {closes}
            </div>
          )}

          <div className="label meet-detail-tally">
            {convergenceSummary(point)}
            {closes && point.lifecycle !== "expiring_soon" ? ` · ${closes}` : ""}
          </div>

          <div className="meet-roster">
            {roster.map((m) => {
              const line = memberStatusLine(m);
              return (
                <div className={`meet-roster-row${line.tone === "muted" ? " muted" : ""}`} key={m.userId}>
                  <PresenceAvatar name={m.displayName} color={m.avatarColor} size={32} />
                  <span className="meet-roster-name">
                    {m.displayName ?? "Guest"}
                    {m.isYou && <span className="member-you"> · you</span>}
                  </span>
                  <span className={`meet-roster-status meet-status-${line.tone}`}>
                    {line.icon && <span className="ms" aria-hidden="true">{line.icon}</span>}
                    {line.text}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="meet-status-picker" role="group" aria-label="Your status">
            <StatusPill label="On my way" active={point.myStatus === "going"} busy={busy === "going"} onClick={() => setStatus("going")} />
            <StatusPill label="I'm here" active={point.myStatus === "arrived"} busy={busy === "arrived"} onClick={() => setStatus("arrived")} />
            <StatusPill label="Can't" active={point.myStatus === "not_going"} busy={busy === "not_going"} onClick={() => setStatus("not_going")} />
          </div>

          <button className="btn btn-primary" onClick={() => navigate("/map")}>
            <span className="ms" aria-hidden="true">navigation</span>
            Navigate
          </button>

          {point.isMine && (
            <button className="btn btn-danger meet-cancel" onClick={() => end("cancel")} disabled={busy !== null}>
              <span className="ms" aria-hidden="true">cancel</span>
              {busy === "cancel" ? "Cancelling…" : "Cancel meeting point"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function StatusPill({
  label,
  active,
  busy,
  onClick,
}: {
  label: string;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <button className={`meet-status-pill${active ? " on" : ""}`} onClick={onClick} disabled={busy} aria-pressed={active}>
      {busy ? "…" : label}
    </button>
  );
}

function EndedState({
  title,
  body,
  icon = "flag",
  tone,
}: {
  title: string;
  body: string;
  icon?: string;
  tone?: "danger";
}): JSX.Element {
  const navigate = useNavigate();
  return (
    <>
      <StackHeader title={title} backTo="/squad" />
      <div className="screen meet-ended">
        <div className={`meet-ended-orb${tone === "danger" ? " danger" : ""}`}>
          <span className="ms">{icon}</span>
        </div>
        <p className="meet-ended-body">{body}</p>
        <button className="btn btn-ghost" onClick={() => navigate("/squad")}>
          Back to squad
        </button>
      </div>
    </>
  );
}
