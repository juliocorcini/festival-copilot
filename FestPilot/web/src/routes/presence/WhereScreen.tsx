/**
 * "Where's the squad" roster (#25.4 — Gate 5.2/5.3, refreshed in Leva 2 G5). Members are grouped by
 * coarse place (busiest stage first, then between-pairs, the vague venue, and a muted "location off"
 * bucket — DEC-098), with honest labels and a live ring for precise sharers. A precise+live member
 * (DEC-099) is plotted at their EXACT coordinate on the peek map and gets a one-tap "Navigate" to
 * them; the coarse roster never carries a coordinate. Ping a stale member / nudge a ghost; answer an
 * incoming ping one-tap with a stage (push-reply, works with GPS off). While opted in, the device
 * shares in the foreground.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useGroupPresence, useLocationSharing } from "../../data/presence";
import { useSharingOptIn } from "../../data/shareOptIn";
import { useT, type TranslateFn } from "../../i18n";
import type { PingDto, PresenceMemberDto, StageDto } from "../../data/types";
import { ErrorState, LoadingState } from "../../ui/states";
import { CoarsePresenceMap } from "./CoarsePresenceMap";
import { StagePickSheet } from "./StagePickSheet";
import {
  PresenceAvatar,
  ago,
  groupRosterByStage,
  mapsDirectionsUrl,
  pingKindFor,
  presenceLine,
  type RosterPlace,
} from "./presenceUi";

type SheetSnap = "peek" | "half" | "full";
const SNAP_PEEK = 110;
const SNAP_HALF_RATIO = 0.45;
const SNAP_FULL_RATIO = 0.85;

function snapHeight(snap: SheetSnap): number {
  const vh = window.innerHeight;
  if (snap === "full") return vh * SNAP_FULL_RATIO;
  if (snap === "half") return vh * SNAP_HALF_RATIO;
  return SNAP_PEEK;
}

function useBottomSheet() {
  const [snap, setSnap] = useState<SheetSnap>("half");
  const [height, setHeight] = useState(() => snapHeight("half"));
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  useEffect(() => { setHeight(snapHeight(snap)); }, [snap]);

  const onDragStart = useCallback((clientY: number) => {
    dragging.current = true;
    startY.current = clientY;
    startH.current = height;
  }, [height]);

  const onDragMove = useCallback((clientY: number) => {
    if (!dragging.current) return;
    const delta = startY.current - clientY;
    const newH = Math.max(SNAP_PEEK, Math.min(window.innerHeight * SNAP_FULL_RATIO, startH.current + delta));
    setHeight(newH);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const vh = window.innerHeight;
    const ratio = height / vh;
    if (ratio > 0.65) setSnap("full");
    else if (ratio > 0.25) setSnap("half");
    else setSnap("peek");
  }, [height]);

  return { snap, setSnap, height, onDragStart, onDragMove, onDragEnd };
}

/** Localised header for a roster place: real stage names stay as data; venue/off are translated. */
function placeLabel(place: RosterPlace, t: TranslateFn): string {
  if (place.kind === "venue") return t("place.venue");
  if (place.kind === "off") return t("place.off");
  return place.label;
}

export function WhereScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const t = useT();
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

  const places = useMemo(() => groupRosterByStage(presence?.members ?? []), [presence]);
  const preciseById = useMemo(
    () => new Map((presence?.precise ?? []).map((p) => [p.userId, p] as const)),
    [presence]
  );
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

  const sheet = useBottomSheet();
  const sheetRef = useRef<HTMLDivElement>(null);

  const handleTouch = useMemo(() => ({
    onTouchStart: (e: React.TouchEvent) => sheet.onDragStart(e.touches[0]!.clientY),
    onTouchMove: (e: React.TouchEvent) => sheet.onDragMove(e.touches[0]!.clientY),
    onTouchEnd: () => sheet.onDragEnd(),
  }), [sheet.onDragStart, sheet.onDragMove, sheet.onDragEnd]);

  if (status === "loading" && !presence) return <LoadingState rows={4} />;
  if (status === "error" && !presence) return <ErrorState message={t("where.loadError")} onRetry={reload} />;

  const count = presence?.memberCount ?? (presence?.members.length ?? 0);
  const invisible = !optedIn || sharing.permission === "denied";

  return (
    <>
      <StackHeader title={t("where.title")} backTo="/squad" />
      <div className="where-map-full">
        <CoarsePresenceMap members={presence?.members ?? []} precise={presence?.precise} onOpen={() => navigate("/map")} />
      </div>

      {inboxPing && (
        <div className="glass where-inbox where-inbox-float">
          <span className="ms" style={{ color: "var(--accent)" }} aria-hidden="true">person_pin_circle</span>
          <div className="where-inbox-main">
            <div className="where-inbox-title">
              {t(inboxPing.kind === "nudge" ? "where.inboxAskedShare" : "where.inboxAskedWhere", {
                name: inboxPing.fromName ?? t("where.inboxSomeone"),
              })}
            </div>
            <div className="where-inbox-sub">{t("where.inboxSub")}</div>
          </div>
          <div className="where-inbox-actions">
            <button className="btn btn-primary btn-sm" onClick={() => openAnswer(inboxPing)}>{t("where.inboxShare")}</button>
            <button className="where-inbox-dismiss" aria-label={t("where.inboxDismiss")} onClick={() => dismiss(inboxPing)}>
              <span className="ms">close</span>
            </button>
          </div>
        </div>
      )}

      <div
        className="where-sheet"
        ref={sheetRef}
        style={{ height: sheet.height }}
      >
        <div className="where-sheet-handle" {...handleTouch}>
          <span className="where-sheet-grip" />
        </div>

        <div className="where-sheet-head">
          <span className="where-sub label">
            {t(count === 1 ? "where.personOne" : "where.personMany", { count })} · {t("where.live")}
          </span>
          <button
            className="where-sheet-toggle"
            aria-label={sheet.snap === "peek" ? "expand" : "collapse"}
            onClick={() => sheet.setSnap(sheet.snap === "peek" ? "half" : "peek")}
          >
            <span className="ms">{sheet.snap === "peek" ? "expand_less" : "expand_more"}</span>
          </button>
        </div>

        <div className="where-sheet-body">
          {invisible && (
            <button className="glass where-invisible" onClick={() => navigate(`/squad/${id}/location`)}>
              <span className="ms" aria-hidden="true">visibility_off</span>
              <div>
                <div className="where-invisible-title">{t("where.invisibleTitle")}</div>
                <div className="where-invisible-sub">{t("where.invisibleSub")}</div>
              </div>
              <span className="ms" style={{ color: "var(--accent)" }} aria-hidden="true">chevron_right</span>
            </button>
          )}

          <div className="where-places">
            {places.map((place) => (
              <section className="where-place" key={place.key}>
                <div className="where-place-head">
                  <span className={`where-place-dot kind-${place.kind}`} aria-hidden="true" />
                  <span className="where-place-label">{placeLabel(place, t)}</span>
                  <span className="where-place-count">{t("where.countHere", { count: place.members.length })}</span>
                </div>
                <div className="where-list">
                  {place.members.map((m) => {
                    const exact = preciseById.get(m.userId);
                    const line = presenceLine(m, t, exact);
                    const fresh = !line.muted && m.presence;
                    const kind = pingKindFor(m);
                    return (
                      <div className={`glass where-row${line.muted ? " muted" : ""}${m.live ? " is-live" : ""}`} key={m.userId}>
                        <PresenceAvatar name={m.displayName} color={m.avatarColor} live={m.live} />
                        <div className="where-row-main">
                          <div className="where-row-name">
                            {m.displayName ?? t("where.guest")}
                            {m.isYou && <span className="where-you"> · {t("where.you")}</span>}
                            {m.isTest && <span className="pill where-test">{t("where.test")}</span>}
                            {m.live && <span className="pill pill-live">● {t("where.live")}</span>}
                          </div>
                          <div className="where-row-line">
                            {line.icon && <span className="ms where-row-icon" aria-hidden="true">{line.icon}</span>}
                            <span>{line.text}</span>
                            {line.sub && <span className="where-row-sub">· {line.sub}</span>}
                          </div>
                        </div>
                        {exact && !m.isYou ? (
                          <a
                            className="pill where-navigate"
                            href={mapsDirectionsUrl(exact.lat, exact.lng)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <span className="ms" aria-hidden="true">navigation</span>
                            {t("where.navigate")}
                          </a>
                        ) : fresh ? (
                          <div className={`where-row-age${m.live ? " live" : ""}`}>{ago(m.presence!.ageSeconds, t)}</div>
                        ) : (
                          kind && (
                            <button
                              className="pill where-ping"
                              disabled={pinged[m.userId]}
                              onClick={() => ping(m, kind)}
                            >
                              {pinged[m.userId] ? t("where.sent") : kind === "nudge" ? t("where.nudge") : t("where.ping")}
                            </button>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          <div className="where-actions">
            <button className="btn btn-primary" onClick={() => navigate(`/squad/${id}/precise`)}>
              <span className="ms" aria-hidden="true">my_location</span>
              {presence?.me.live ? t("where.managePrecise") : t("where.sharePrecise")}
            </button>
            <button className="btn btn-ghost" onClick={() => navigate(`/squad/${id}/visibility`)}>
              <span className="ms" aria-hidden="true">tune</span>
              {t("where.howYouAppear")}
            </button>
          </div>
        </div>
      </div>

      {answering && (
        <StagePickSheet
          title={t("where.pickStageTitle")}
          stages={stages}
          busy={answerBusy}
          onPick={answer}
          onClose={() => setAnswering(null)}
        />
      )}
    </>
  );
}
