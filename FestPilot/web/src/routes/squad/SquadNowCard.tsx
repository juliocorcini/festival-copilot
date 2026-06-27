/**
 * "Squad now" — the Phase 9 (D4) bridge that brings a sliver of the squad onto the personal Home.
 *
 * It is STRICTLY ADDITIVE and self-gating, in two layers so a solo Home is untouched:
 *   1. no account → render null BEFORE any squad network call (most solo users never hit the API);
 *   2. account but no squad → render null once we KNOW the list is empty (no layout shift).
 * For a squad user it shows ONE compact, tappable card: where the squad is right now (a presence
 * summary) + the next thing on the agenda (a live/upcoming group event, else an active meeting
 * point), and it opens the full Squad on tap. It only READS existing hooks — it never writes, and
 * never feeds the squad plan or any personal lock (it lives entirely alongside them).
 */
import { useNavigate } from "react-router-dom";
import { useT } from "../../i18n";
import { useIdentity } from "../../data/identity";
import { useMyGroups } from "../../data/groups";
import { useGroupPresence } from "../../data/presence";
import { useGroupEvents } from "../../data/groupEvents";
import { useMeetingPoints } from "../../data/meetingPoints";
import type { GroupDto, PresenceMemberDto } from "../../data/types";
import { groupRosterByStage } from "../presence/presenceUi";
import { eventBadge, eventCountdown, eventLifecycleFromIso, type EventBadge } from "./eventsUi";
import { firstActivePoint, pointBadge, presenceSummary } from "./squadNowUi";
import { openOnActivate } from "../../ui/useArtistSheet";

/** Same key SquadScreen writes, so Home mirrors the squad the user last looked at (else the first). */
const ACTIVE_GROUP_KEY = "fp.activeGroup.v1";
function readActiveGroup(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY);
  } catch {
    return null;
  }
}

export function SquadNowCard(): JSX.Element | null {
  const { hasProfile } = useIdentity();
  // Layer 1 — no account means no squad: bail before touching the network.
  if (!hasProfile) return null;
  return <SquadNowGate />;
}

function SquadNowGate(): JSX.Element | null {
  const { groups, status } = useMyGroups();
  // Layer 2 — only commit space once we KNOW there is a squad (no flash for the empty case).
  if (status !== "ready" || groups.length === 0) return null;
  const activeId = readActiveGroup();
  const group = groups.find((g) => g.id === activeId) ?? groups[0]!;
  return <SquadNowInner key={group.id} group={group} />;
}

function SquadNowInner({ group }: { group: GroupDto }): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const { presence, status: presenceStatus } = useGroupPresence(group.id);
  const { events } = useGroupEvents(group.id);
  const { points } = useMeetingPoints(group.id);
  const now = Date.now();

  const members: PresenceMemberDto[] = presence?.members ?? [];
  const liveCount = presence?.liveCount ?? 0;

  // The next agenda item, in priority: a not-yet-ended group event wins; else an active meeting point.
  const nextEvent =
    events.find((e) => eventLifecycleFromIso(e.startsAtUtc, e.endsAtUtc, now) !== "past") ?? null;
  const activePoint = nextEvent ? null : firstActivePoint(points);

  // We already KNOW there's a squad, so the first presence fetch shows an in-card skeleton (not blank).
  const loading = presenceStatus === "loading" && members.length === 0;
  const go = (): void => navigate("/squad");

  return (
    <section
      className="glass squad-now tappable fp-rise"
      role="button"
      tabIndex={0}
      aria-label={t("squad.openGroup", { name: group.name })}
      onClick={go}
      onKeyDown={openOnActivate(go)}
    >
      <div className="squad-now-head">
        <span className="squad-now-emoji" aria-hidden>
          {group.emoji ?? "\u{1F3AA}"}
        </span>
        <span className="squad-now-name">{group.name}</span>
        <span className="squad-now-live">
          {liveCount > 0 ? (
            <>
              <span className="live" />
              {t("squad.live", { count: liveCount })}
            </>
          ) : (
            `${group.memberCount} ${group.memberCount === 1 ? t("common.member") : t("common.members")}`
          )}
        </span>
        <span className="ms squad-now-chev" aria-hidden>
          chevron_right
        </span>
      </div>

      {loading ? (
        <div className="squad-now-body" aria-hidden>
          <div className="shimmer" style={{ height: 16, width: "70%" }} />
          <div className="shimmer" style={{ height: 16, width: "50%" }} />
        </div>
      ) : (
        <div className="squad-now-body">
          <PresenceSummary members={members} />
          {nextEvent && (
            <AgendaLine
              icon="event"
              title={nextEvent.title}
              meta={eventCountdown(nextEvent.startsAtUtc, nextEvent.endsAtUtc, now)}
              badge={eventBadge(eventLifecycleFromIso(nextEvent.startsAtUtc, nextEvent.endsAtUtc, now))}
            />
          )}
          {activePoint && (
            <AgendaLine
              icon={activePoint.isSafety ? "e911_emergency" : "pin_drop"}
              title={activePoint.title}
              meta={activePoint.landmarkLabel}
              badge={pointBadge(activePoint)}
            />
          )}
        </div>
      )}
    </section>
  );
}

function PresenceSummary({ members }: { members: PresenceMemberDto[] }): JSX.Element {
  const summary = presenceSummary(groupRosterByStage(members));
  return (
    <p className={`squad-now-presence${summary.muted ? " is-muted" : ""}`}>
      <span className="ms" aria-hidden>
        group
      </span>
      {summary.text}
    </p>
  );
}

function AgendaLine({
  icon,
  title,
  meta,
  badge,
}: {
  icon: string;
  title: string;
  meta: string;
  badge: EventBadge;
}): JSX.Element {
  return (
    <div className="squad-now-agenda">
      <span className="ms squad-now-agenda-icon" aria-hidden>
        {icon}
      </span>
      <span className="squad-now-agenda-title">{title}</span>
      <span className="squad-now-agenda-meta">{meta}</span>
      <span className={`pill meet-badge meet-badge-${badge.tone}`}>{badge.label}</span>
    </div>
  );
}
