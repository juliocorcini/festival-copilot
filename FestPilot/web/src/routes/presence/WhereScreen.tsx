/**
 * "Where's the squad" roster (#25.4 — Gate 5.2/5.3). Coarse map peek + member list with honest
 * labels: "at MAINSTAGE" / "near X" / "between A & B" / "last seen Nm ago" / "not sharing", a live
 * ring for precise sharers, and the current-artist auto-detect ("watching …"). No coordinate ever
 * reaches the client. Ping a stale member / Nudge a ghost; answer an incoming ping one-tap with a
 * stage (push-reply, works with GPS off). While opted in, the device shares in foreground.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useGroupPresence, useLocationSharing } from "../../data/presence";
import { useSharingOptIn } from "../../data/shareOptIn";
import type { PingDto, PresenceMemberDto, StageDto } from "../../data/types";
import { ErrorState, LoadingState } from "../../ui/states";
import { CoarsePresenceMap } from "./CoarsePresenceMap";
import { StagePickSheet } from "./StagePickSheet";
import { PresenceAvatar, ago, pingKindFor, presenceLine, sortRoster } from "./presenceUi";

export function WhereScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { group } = useGroup(id);
  const { presence, status, reload } = useGroupPresence(id);
  const optedIn = useSharingOptIn();
  const sharing = useLocationSharing(reload);

  const [pinged, setPinged] = useState<Record<string, true>>({});
  const [answering, setAnswering] = useState<PingDto | null>(null);
  const [stages, setStages] = useState<StageDto[] | null>(null);
  const [answerBusy, setAnswerBusy] = useState(false);

  // While on this screen, keep the user's own dot fresh if they've opted in and granted permission.
  useEffect(() => {
    if (optedIn && sharing.supported && sharing.permission !== "denied" && !sharing.active) {
      void sharing.enable();
    }
  }, [optedIn, sharing.supported, sharing.permission, sharing.active, sharing.enable]);

  const roster = useMemo(() => sortRoster(presence?.members ?? []), [presence]);
  const inboxPing = presence?.inbox?.[0] ?? null;

  const ping = useCallback(
    async (m: PresenceMemberDto, kind: "locate" | "nudge"): Promise<void> => {
      if (!id) return;
      setPinged((p) => ({ ...p, [m.userId]: true }));
      try {
        await api.sendPing(id, m.userId, kind);
      } catch {
        setPinged((p) => {
          const next = { ...p };
          delete next[m.userId];
          return next;
        });
      }
    },
    [id]
  );

  const openAnswer = async (p: PingDto): Promise<void> => {
    setAnswering(p);
    if (stages === null && group) {
      try {
        setStages(await api.listStages(group.festivalId));
      } catch {
        setStages([]);
      }
    }
  };

  const answer = async (stageId: string): Promise<void> => {
    if (!id || !answering || answerBusy) return;
    setAnswerBusy(true);
    try {
      await api.answerPing(id, answering.id, stageId);
    } catch {
      /* keep the sheet on failure */
    }
    setAnswerBusy(false);
    setAnswering(null);
    reload();
  };

  const dismiss = async (p: PingDto): Promise<void> => {
    if (!id) return;
    try {
      await api.dismissPing(id, p.id);
    } catch {
      /* best-effort */
    }
    reload();
  };

  if (status === "loading" && !presence) return <LoadingState rows={4} />;
  if (status === "error" && !presence) return <ErrorState message="Couldn't load the squad's location." onRetry={reload} />;

  const count = presence?.memberCount ?? roster.length;
  const invisible = !optedIn || sharing.permission === "denied";

  return (
    <>
      <StackHeader title="Where's the squad" backTo="/squad" />
      <div className="screen where-screen">
        <div className="where-sub label">{count} {count === 1 ? "person" : "people"} · live</div>

        {inboxPing && (
          <div className="glass where-inbox">
            <span className="ms" style={{ color: "var(--accent)" }} aria-hidden="true">person_pin_circle</span>
            <div className="where-inbox-main">
              <div className="where-inbox-title">
                {inboxPing.fromName ?? "A squad-mate"} {inboxPing.kind === "nudge" ? "asked you to share" : "asked where you are"}
              </div>
              <div className="where-inbox-sub">Answer with your stage — no GPS needed.</div>
            </div>
            <div className="where-inbox-actions">
              <button className="btn btn-primary btn-sm" onClick={() => openAnswer(inboxPing)}>Share</button>
              <button className="where-inbox-dismiss" aria-label="Dismiss" onClick={() => dismiss(inboxPing)}>
                <span className="ms">close</span>
              </button>
            </div>
          </div>
        )}

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
            const kind = pingKindFor(m);
            return (
              <div className={`glass where-row${line.muted ? " muted" : ""}${m.live ? " is-live" : ""}`} key={m.userId}>
                <PresenceAvatar name={m.displayName} color={m.avatarColor} live={m.live} />
                <div className="where-row-main">
                  <div className="where-row-name">
                    {m.displayName ?? "Guest"}
                    {m.isYou && <span className="where-you"> · you</span>}
                    {m.isTest && <span className="pill where-test">test</span>}
                    {m.live && <span className="pill pill-live">● live</span>}
                  </div>
                  <div className="where-row-line">
                    {line.icon && <span className="ms where-row-icon" aria-hidden="true">{line.icon}</span>}
                    <span>{line.text}</span>
                    {line.sub && <span className="where-row-sub">· {line.sub}</span>}
                  </div>
                </div>
                {fresh && <div className={`where-row-age${m.live ? " live" : ""}`}>{ago(m.presence!.ageSeconds)}</div>}
                {!fresh && kind && (
                  <button
                    className="pill where-ping"
                    disabled={pinged[m.userId]}
                    onClick={() => ping(m, kind)}
                  >
                    {pinged[m.userId] ? "Sent" : kind === "nudge" ? "Nudge" : "Ping"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="where-actions">
          <button className="btn btn-primary" onClick={() => navigate(`/squad/${id}/precise`)}>
            <span className="ms" aria-hidden="true">my_location</span>
            {presence?.me.live ? "Manage precise pin" : "Share a precise pin"}
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(`/squad/${id}/visibility`)}>
            <span className="ms" aria-hidden="true">tune</span>
            How you appear
          </button>
        </div>
      </div>

      {answering && (
        <StagePickSheet
          title="Which stage are you at?"
          stages={stages}
          busy={answerBusy}
          onPick={answer}
          onClose={() => setAnswering(null)}
        />
      )}
    </>
  );
}
