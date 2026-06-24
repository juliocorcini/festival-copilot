/**
 * "Where's the squad" roster (#25.4 — Gate 5.2). Coarse map peek + member list with honest labels:
 * "at MAINSTAGE" / "near X" / "between A & B" / "last seen Nm ago" / "not sharing", a live ring for
 * precise sharers, and the current-artist auto-detect ("watching …"). No coordinate ever reaches
 * the client. While this screen is open and the user has opted in, the device shares in foreground.
 */
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useGroupPresence, useLocationSharing } from "../../data/presence";
import { useSharingOptIn } from "../../data/shareOptIn";
import type { PresenceMemberDto } from "../../data/types";
import { ErrorState, LoadingState } from "../../ui/states";
import { CoarsePresenceMap } from "./CoarsePresenceMap";
import { PresenceAvatar, ago, presenceLine } from "./presenceUi";

/** Rank for the roster: live first, then fresh sharers (newest), then stale, then not-sharing. */
function rank(m: PresenceMemberDto): number {
  if (m.live) return 0;
  if (m.shareMode === "ghost") return 3;
  if (!m.presence) return 3;
  return m.presence.stale ? 2 : 1;
}

function sortRoster(members: PresenceMemberDto[]): PresenceMemberDto[] {
  return [...members].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    const aa = a.presence?.ageSeconds ?? Number.POSITIVE_INFINITY;
    const ba = b.presence?.ageSeconds ?? Number.POSITIVE_INFINITY;
    return aa - ba;
  });
}

export function WhereScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { presence, status, reload } = useGroupPresence(id);
  const optedIn = useSharingOptIn();
  const sharing = useLocationSharing(reload);

  // While on this screen, keep the user's own dot fresh if they've opted in and granted permission.
  useEffect(() => {
    if (optedIn && sharing.supported && sharing.permission !== "denied" && !sharing.active) {
      void sharing.enable();
    }
  }, [optedIn, sharing.supported, sharing.permission, sharing.active, sharing.enable]);

  const roster = useMemo(() => sortRoster(presence?.members ?? []), [presence]);

  if (status === "loading" && !presence) return <LoadingState rows={4} />;
  if (status === "error" && !presence) return <ErrorState message="Couldn't load the squad's location." onRetry={reload} />;

  const count = presence?.memberCount ?? roster.length;
  const invisible = !optedIn || sharing.permission === "denied";
  const meLive = presence?.me.live ?? false;

  return (
    <>
      <StackHeader title="Where's the squad" backTo="/squad" />
      <div className="screen where-screen">
        <div className="where-sub label">{count} {count === 1 ? "person" : "people"} · live</div>

        <CoarsePresenceMap members={roster} onOpen={() => navigate("/map")} />

        {invisible && (
          <button className="glass where-invisible" onClick={() => navigate(`/squad/${id}/location`)}>
            <span className="ms" aria-hidden="true">visibility_off</span>
            <div>
              <div className="where-invisible-title">You're invisible to the squad</div>
              <div className="where-invisible-sub">Turn on location to appear on the map</div>
            </div>
            <span className="ms" style={{ color: "var(--accent)" }} aria-hidden="true">chevron_right</span>
          </button>
        )}

        <div className="where-list">
          {roster.map((m) => {
            const line = presenceLine(m);
            const fresh = !line.muted && m.presence;
            return (
              <div className={`glass where-row${line.muted ? " muted" : ""}${m.live ? " is-live" : ""}`} key={m.userId}>
                <PresenceAvatar name={m.displayName} color={m.avatarColor} live={m.live} />
                <div className="where-row-main">
                  <div className="where-row-name">
                    {m.displayName ?? "Guest"}
                    {m.isYou && <span className="where-you"> · you</span>}
                    {m.live && <span className="pill pill-live">● live</span>}
                  </div>
                  <div className="where-row-line">
                    {line.icon && <span className="ms where-row-icon" aria-hidden="true">{line.icon}</span>}
                    <span>{line.text}</span>
                    {line.sub && <span className="where-row-sub">· {line.sub}</span>}
                  </div>
                </div>
                {fresh && (
                  <div className={`where-row-age${m.live ? " live" : ""}`}>{ago(m.presence!.ageSeconds)}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="where-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/squad/${id}/precise`)}>
            <span className="ms" aria-hidden="true">my_location</span>
            {meLive ? "Manage precise pin" : "Share a precise pin"}
          </button>
        </div>
      </div>
    </>
  );
}
