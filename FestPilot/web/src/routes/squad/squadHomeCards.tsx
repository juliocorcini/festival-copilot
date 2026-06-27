/**
 * Content-first squad-home cards (#23.7 redesign — wireframe 20-amber-squad). Three inline cards that
 * answer the squad's live questions without a tap:
 *   • WhereEveryoneCard — the roster clustered by coarse stage, with a one-tap "Ping all";
 *   • MeetingCompassCard — the active meeting point with a live distance + compass arrow + "Go";
 *   • BoardPreviewCard — the top pinned notes with an "Add note" shortcut.
 * Each degrades to a calm empty-state CTA so an empty squad still reads well. The cards stay
 * presentational: data is fetched by the parent (presence / meeting points / board hooks) and passed
 * in; only device sensors (GPS + compass) are read here, where a live fix is actually shown.
 */
import { useEffect, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../data/api";
import { useSafety } from "../../data/meetingPoints";
import { bearingDegrees, compassPoint, metersBetween } from "../../domain/travel";
import { stageColor } from "../../lib/format";
import { useT, type TranslateFn } from "../../i18n";
import { useHeading, useMyFix } from "../../lib/useGeo";
import type { BoardNoteDto, GroupEventDto, GroupPresenceDto, MeetingPointDto } from "../../data/types";
import { ago, groupRosterByStage, pingKindFor, PresenceAvatar } from "../presence/presenceUi";
import { closesInLabel, convergenceSummary, formatMeters, lifecycleBadge } from "../meet/meetUi";
import { durationLabel, eventBadge, eventCountdown, eventLifecycleFromIso } from "./eventsUi";
import { firstActivePoint } from "./squadNowUi";
import { squadNextUp, type SquadFocus } from "../../domain/squadNextUp";

const MAX_AVATARS = 4;

/** Treat a click on a nested control as "handled" so the card's own navigation doesn't also fire. */
function stop(e: { stopPropagation: () => void }): void {
  e.stopPropagation();
}

/** Enter / Space activate a div acting as a button (keyboard parity for the tappable cards). */
function onCardKey(run: () => void): (e: KeyboardEvent) => void {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      run();
    }
  };
}

/** "WHERE IS EVERYONE" — the live roster grouped by coarse stage, with a one-tap "Ping all". */
export function WhereEveryoneCard({
  groupId,
  presence,
}: {
  groupId: string;
  presence: GroupPresenceDto | null;
}): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const [pinged, setPinged] = useState(false);
  const members = presence?.members ?? [];
  const places = groupRosterByStage(members);
  const livePlaces = places.filter((p) => p.kind !== "off");
  // Localize the two non-proper-noun place labels (stage/between labels are venue names — kept as-is).
  const placeLabel = (place: { kind: string; label: string }): string =>
    place.kind === "off" ? t("squad.locationOffPlace") : place.kind === "venue" ? t("squad.inVenue") : place.label;
  const pingable = members.filter((m) => pingKindFor(m) !== null);
  const open = (): void => navigate(`/squad/${groupId}/where`);

  const pingAll = async (e: { stopPropagation: () => void }): Promise<void> => {
    stop(e);
    if (pinged || pingable.length === 0) return;
    setPinged(true);
    await Promise.allSettled(pingable.map((m) => api.sendPing(groupId, m.userId, pingKindFor(m)!)));
    window.setTimeout(() => setPinged(false), 4000);
  };

  return (
    <section className="glass squad-card">
      <header className="squad-card-head">
        <span className="squad-card-eyebrow">{t("squad.whereEveryone")}</span>
        {pingable.length > 0 && (
          <button className="squad-ping" onClick={(e) => void pingAll(e)} disabled={pinged}>
            <span className="ms" aria-hidden="true">{pinged ? "check" : "campaign"}</span>
            {pinged ? t("squad.pinged") : t("squad.pingAll")}
          </button>
        )}
      </header>

      {livePlaces.length === 0 ? (
        <div className="squad-card-empty" role="button" tabIndex={0} onClick={open} onKeyDown={onCardKey(open)}>
          <span className="ms" aria-hidden="true">location_searching</span>
          <div className="squad-card-empty-main">
            <div className="squad-card-empty-title">{t("squad.noOneSharingTitle")}</div>
            <div className="squad-card-empty-sub">{t("squad.noOneSharingSub")}</div>
          </div>
          <span className="ms squad-card-chev" aria-hidden="true">chevron_right</span>
        </div>
      ) : (
        <div className="where-rows" role="button" tabIndex={0} onClick={open} onKeyDown={onCardKey(open)}>
          {places.map((place) => (
            <div className={`where-row${place.kind === "off" ? " is-off" : ""}`} key={place.key}>
              <span
                className="where-dot"
                style={{ background: place.stageName ? stageColor(place.stageName) : "var(--muted)" }}
              />
              <span className="where-label">
                {placeLabel(place)}
                {place.hasYou && <span className="where-you"> · {t("squad.withYou")}</span>}
              </span>
              <span className="squad-live-stack">
                {place.members.slice(0, MAX_AVATARS).map((m) => (
                  <PresenceAvatar key={m.userId} name={m.displayName} color={m.avatarColor} size={26} live={m.live} />
                ))}
                {place.members.length > MAX_AVATARS && (
                  <span className="squad-ava squad-ava-more where-more">+{place.members.length - MAX_AVATARS}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** A live meeting point: distance + compass arrow to the spot, with "Go" into turn-free navigation. */
export function MeetingCompassCard({ groupId, point }: { groupId: string; point: MeetingPointDto }): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const { fix, denied } = useMyFix();
  const { heading } = useHeading();

  const target = { lat: point.lat, lng: point.lng };
  const distance = fix ? metersBetween(fix, target) : null;
  const bearing = fix ? bearingDegrees(fix, target) : null;
  // North-up when there's no compass; otherwise rotate the bearing into the phone's frame.
  const arrowDeg = bearing == null ? 0 : heading == null ? bearing : (bearing - heading + 360) % 360;
  const closesIn = closesInLabel(point.expiresAtUtc);
  const badge = lifecycleBadge(point.lifecycle);
  const owner = point.isMine ? t("common.you") : point.createdByName ?? t("squad.aSquadmate");

  const open = (): void => navigate(`/squad/${groupId}/meet/${point.id}`);
  const go = (e: { stopPropagation: () => void }): void => {
    stop(e);
    navigate(`/squad/${groupId}/meet/${point.id}/nav`);
  };

  return (
    <section className="glass meet-compass-card" role="button" tabIndex={0} onClick={open} onKeyDown={onCardKey(open)}>
      <div
        className={`meet-compass-banner${point.isSafety ? " is-safety" : ""}`}
        style={point.photoUrl ? { backgroundImage: `url(${point.photoUrl})` } : undefined}
      >
        {!point.photoUrl && <span className="ms meet-compass-banner-icon" aria-hidden="true">flag</span>}
        <span className="meet-compass-chip">{point.isSafety ? t("squad.safety") : t("squad.meetingPoint")}</span>
        <span className={`pill meet-badge meet-badge-${badge.tone} meet-compass-badge`}>{badge.label}</span>
      </div>
      <div className="meet-compass-body">
        <div className={`mini-compass${bearing == null ? " pending" : ""}`} aria-hidden="true">
          <span className="ms" style={{ transform: `rotate(${arrowDeg}deg)` }}>navigation</span>
        </div>
        <div className="meet-compass-main">
          <div className="meet-compass-title">{point.title}</div>
          <div className="meet-compass-where">{point.landmarkLabel}</div>
          <div className="meet-compass-meta">
            {distance != null ? (
              <>
                <b>{formatMeters(Math.round(distance))}</b>
                {bearing != null ? ` · ${compassPoint(bearing)}` : ""} ·{" "}
              </>
            ) : (
              `${denied ? t("squad.locationOff") : t("squad.locating")} · `
            )}
            {convergenceSummary(point)} · {t("squad.by", { who: owner })}
            {closesIn ? ` · ${closesIn}` : ""}
          </div>
        </div>
        <button className="btn btn-primary meet-compass-go" onClick={go} aria-label={t("squad.navigateToSpot")}>
          <span className="ms" aria-hidden="true">near_me</span>
          {t("squad.go")}
        </button>
      </div>
    </section>
  );
}

/** "PINNED BOARD" — the top notes inline, with an "Add note" shortcut into the full board. */
export function BoardPreviewCard({
  groupId,
  notes,
  loading,
}: {
  groupId: string;
  notes: BoardNoteDto[];
  loading: boolean;
}): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const open = (): void => navigate(`/squad/${groupId}/board`);
  const top = notes.slice(0, 3);

  return (
    <section className="glass squad-card">
      <header className="squad-card-head">
        <span className="squad-card-eyebrow">{t("squad.pinnedBoard")}</span>
        <button className="squad-add" onClick={(e) => { stop(e); open(); }}>
          <span className="ms" aria-hidden="true">add</span>
          {t("squad.addNote")}
        </button>
      </header>

      {loading && top.length === 0 ? (
        <div className="board-preview-skeleton" aria-hidden="true">
          <span /> <span /> <span />
        </div>
      ) : top.length === 0 ? (
        <div className="squad-card-empty" role="button" tabIndex={0} onClick={open} onKeyDown={onCardKey(open)}>
          <span className="ms" aria-hidden="true">push_pin</span>
          <div className="squad-card-empty-main">
            <div className="squad-card-empty-title">{t("squad.nothingPinnedTitle")}</div>
            <div className="squad-card-empty-sub">{t("squad.nothingPinnedSub")}</div>
          </div>
          <span className="ms squad-card-chev" aria-hidden="true">chevron_right</span>
        </div>
      ) : (
        <div className="board-preview-list" role="button" tabIndex={0} onClick={open} onKeyDown={onCardKey(open)}>
          {top.map((note) => (
            <div className="board-preview-row" key={note.id}>
              <span className="ms board-preview-pin" aria-hidden="true">push_pin</span>
              <div className="board-preview-text">
                <div className="board-preview-body">{note.body}</div>
                <div className="board-preview-who">
                  {note.authorName ?? t("common.guest")} · {relativeTime(note.createdAtUtc, t)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const NEXTUP_ICON: Record<SquadFocus["kind"], string> = { set: "music_note", event: "event", meet: "pin_drop" };

/**
 * "NEXT UP" — the single most relevant thing the squad is doing now/next (D20/D24 · DEC-086). It reads
 * the parallel lanes the squad already has — group events + the active meeting point (and optionally
 * the aggregated set plan) — via the pure `squadNextUp` selector, NEVER mixing them into the
 * aggregation. Presentational: the parent passes the live hooks; tapping opens the squad plan (or a
 * caller-supplied target, e.g. the whole Squad from Home).
 */
export function SquadNextUpCard({
  groupId,
  events,
  points,
  presence,
  sets = [],
  onOpen,
}: {
  groupId: string;
  events: GroupEventDto[];
  points: MeetingPointDto[];
  presence: GroupPresenceDto | null;
  sets?: { label: string; stageName: string; startMs: number; endMs: number }[];
  onOpen?: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const focus = squadNextUp({ sets, events, meet: firstActivePoint(points), now });
  const liveCount = presence?.liveCount ?? 0;
  const open = onOpen ?? ((): void => navigate(`/squad/${groupId}/plan`));

  // The time chip mirrors the event tones: live → green "Live now", soon (≤30 min) → amber, else neutral.
  let chipLabel = t("squad.liveNow");
  let chipTone: "go" | "warn" | "active" = "go";
  if (focus && !focus.live && focus.startMs != null) {
    const mins = (focus.startMs - now) / 60_000;
    chipLabel = t("squad.inTime", { time: durationLabel(mins) });
    chipTone = mins <= 30 ? "warn" : "active";
  }

  return (
    <section
      className="glass squad-card squad-nextup"
      role="button"
      tabIndex={0}
      aria-label={t("squad.nextUp")}
      onClick={open}
      onKeyDown={onCardKey(open)}
    >
      <header className="squad-card-head">
        <span className="squad-card-eyebrow">{t("squad.nextUp")}</span>
        {liveCount > 0 && (
          <span className="squad-nextup-live">
            <span className="live" aria-hidden="true" />
            {t("squad.live", { count: liveCount })}
          </span>
        )}
        <span className="ms squad-card-chev" aria-hidden="true">chevron_right</span>
      </header>

      {focus ? (
        <div className="squad-nextup-row">
          <span className="squad-nextup-icon ms" aria-hidden="true">{NEXTUP_ICON[focus.kind]}</span>
          <div className="squad-nextup-main">
            <div className="squad-nextup-title">{focus.title}</div>
            {focus.where && (
              <div className="squad-nextup-where">
                {focus.kind === "set" && <span className="dot" style={{ background: stageColor(focus.where) }} />}
                {focus.where}
              </div>
            )}
          </div>
          <span className={`pill meet-badge meet-badge-${chipTone}`}>{chipLabel}</span>
        </div>
      ) : (
        <div className="squad-nextup-quiet">{t("squad.nextUpQuiet")}</div>
      )}
    </section>
  );
}

/** "SQUAD AGENDA" — the next fixed-time group moments (Phase 8), each with a live countdown. */
export function SquadAgendaCard({ groupId, events }: { groupId: string; events: GroupEventDto[] }): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const open = (): void => navigate(`/squad/${groupId}/events`);
  const top = events.slice(0, 2);

  return (
    <section className="glass squad-card">
      <header className="squad-card-head">
        <span className="squad-card-eyebrow">{t("squad.agenda")}</span>
        <button className="squad-add" onClick={(e) => { stop(e); open(); }}>
          <span className="ms" aria-hidden="true">add</span>
          {t("squad.add")}
        </button>
      </header>

      {top.length === 0 ? (
        <div className="squad-card-empty" role="button" tabIndex={0} onClick={open} onKeyDown={onCardKey(open)}>
          <span className="ms" aria-hidden="true">event</span>
          <div className="squad-card-empty-main">
            <div className="squad-card-empty-title">{t("squad.noMomentsTitle")}</div>
            <div className="squad-card-empty-sub">{t("squad.noMomentsSub")}</div>
          </div>
          <span className="ms squad-card-chev" aria-hidden="true">chevron_right</span>
        </div>
      ) : (
        <div className="agenda-rows" role="button" tabIndex={0} onClick={open} onKeyDown={onCardKey(open)}>
          {top.map((ev) => {
            const lifecycle = eventLifecycleFromIso(ev.startsAtUtc, ev.endsAtUtc, now);
            const badge = eventBadge(lifecycle);
            return (
              <div className={`agenda-row${lifecycle === "live" ? " is-live" : ""}`} key={ev.id}>
                <span className="agenda-row-title">{ev.title}</span>
                {ev.stageName && (
                  <span className="agenda-row-stage">
                    <span className="dot" style={{ background: stageColor(ev.stageName) }} />
                    {ev.stageName}
                  </span>
                )}
                <span className={`pill meet-badge meet-badge-${badge.tone} agenda-row-badge`}>
                  {eventCountdown(ev.startsAtUtc, ev.endsAtUtc, now)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/**
 * SOS banner (Gate 6.3, E12/DEC-100). A calm, high-visibility row shown wherever the squad is in
 * view — the squad home AND the Now screen — so a "needs help" is never buried. Presentational: the
 * caller passes the active safety points (so a screen that already loads them doesn't double-fetch).
 * Returns null when nobody's broadcasting. Tapping opens the safety flow (navigate to / "I'm okay").
 */
export function SafetyBanner({ groupId, points }: { groupId: string; points: MeetingPointDto[] }): JSX.Element | null {
  const navigate = useNavigate();
  const t = useT();
  if (points.length === 0) return null;
  const mine = points.some((p) => p.isMine);
  const other = points.find((p) => !p.isMine) ?? null;
  return (
    <button className="glass safety-home-banner" onClick={() => navigate(`/squad/${groupId}/safety`)}>
      <span className="safety-home-pulse">
        <span className="ms">{mine ? "share_location" : "sos"}</span>
      </span>
      <div className="safety-home-main">
        <div className="safety-home-title">
          {mine ? t("squad.sharingLocation") : t("squad.needsHelp", { name: other?.createdByName ?? t("squad.aSquadmate") })}
        </div>
        <div className="safety-home-sub">
          {mine ? t("squad.sharingSub") : t("squad.needsHelpSub", { landmark: other?.landmarkLabel ?? "" })}
        </div>
      </div>
      <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
    </button>
  );
}

/** Self-fetching SOS banner for screens that don't already load the safety lane (e.g. the Now home). */
export function SafetyBannerLive({ groupId }: { groupId: string }): JSX.Element | null {
  const { points } = useSafety(groupId);
  return <SafetyBanner groupId={groupId} points={points} />;
}

/** Compact relative time for the board preview, reusing the presence `ago` scale ("just now" / "20m ago"). */
function relativeTime(iso: string, t: TranslateFn): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  return seconds < 45 ? t("squad.justNow") : t("squad.ago", { time: ago(seconds) });
}
