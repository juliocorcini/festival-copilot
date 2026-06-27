/**
 * Squad tab (Pillar 3). Three states:
 *   • not signed in / no squad → empty hero (#23.1) routing into create / join,
 *   • in ≥1 squad             → group home (#23.7): plan CTA, member list, invite, leave.
 * Identity is Gate 4.1; groups + invites + members are Gate 4.2.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { useT } from "../i18n";
import { api } from "../data/api";
import { useBoard } from "../data/board";
import { useMyGroups, useGroup } from "../data/groups";
import { useMeetingPoints, useSafety } from "../data/meetingPoints";
import { useGroupEvents } from "../data/groupEvents";
import { useGroupPresence } from "../data/presence";
import { useIdentity } from "../data/identity";
import type { GroupDto, MeetingPointDto } from "../data/types";
import { Avatar } from "../ui/Avatar";
import { LoadingState } from "../ui/states";
import { PullToRefresh } from "../ui/PullToRefresh";
import { BoardPreviewCard, MeetingCompassCard, SquadAgendaCard, SquadNextUpCard, WhereEveryoneCard } from "./squad/squadHomeCards";
import { closesInLabel, convergenceSummary, lifecycleBadge } from "./meet/meetUi";

/** Remembers the last squad the user was looking at, so a multi-squad user lands back where they left. */
const ACTIVE_GROUP_KEY = "fp.activeGroup.v1";
function readActiveGroup(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY);
  } catch {
    return null;
  }
}

export function SquadScreen(): JSX.Element {
  const { hasProfile } = useIdentity();
  const { groups, status, reload } = useMyGroups();
  const [activeId, setActiveId] = useState<string | null>(readActiveGroup);

  if (status === "loading") return <LoadingState rows={3} />;
  if (groups.length === 0) return <EmptySquad hasProfile={hasProfile} />;

  // The active squad is the remembered one if it still exists, else the first. Every sub-feature
  // (plan, presence, meeting points, board) keys off `group.id`, so switching isolates the data.
  const active = groups.find((g) => g.id === activeId) ?? groups[0]!;
  const select = (id: string): void => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_GROUP_KEY, id);
    } catch {
      /* private mode — in-memory only */
    }
  };

  return <GroupHome key={active.id} group={active} groups={groups} onSelect={select} onChanged={reload} />;
}

function EmptySquad({ hasProfile }: { hasProfile: boolean }): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const go = (target: string): void =>
    navigate(hasProfile ? target : `/squad/signin?next=${encodeURIComponent(target)}`);

  return (
    <>
      <AppHeader eyebrow={t("squad.together")} title={t("squad.title")} />
      <div className="squad-empty">
        <div className="squad-hero">
          <div className="squad-hero-orb">
            <span className="ms">diversity_3</span>
          </div>
          <h2 className="poster">
            {t("squad.betterTogether1")}
            <br />
            {t("squad.betterTogether2")}
          </h2>
          <p>{t("squad.heroMsg")}</p>
        </div>
        <div className="squad-actions">
          <button className="btn btn-primary" onClick={() => go("/squad/create")}>
            <span className="ms">add</span>
            {t("squad.createSquad")}
          </button>
          <button className="btn btn-ghost" onClick={() => go("/squad/join")}>
            <span className="ms">link</span>
            {t("squad.joinLinkQr")}
          </button>
          <p className="squad-note">{t("squad.quickAccount")}</p>
        </div>
      </div>
    </>
  );
}

function GroupHome({
  group,
  groups,
  onSelect,
  onChanged,
}: {
  group: GroupDto;
  groups: GroupDto[];
  onSelect: (id: string) => void;
  onChanged: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const { members, reload: reloadMembers } = useGroup(group.id);
  const { points, reload: reloadPoints } = useMeetingPoints(group.id);
  const { points: safetyPoints, reload: reloadSafety } = useSafety(group.id);
  const { presence, reload: reloadPresence } = useGroupPresence(group.id);
  const { notes, status: boardStatus, reload: reloadBoard } = useBoard(group.id);
  const { events, reload: reloadEvents } = useGroupEvents(group.id);
  const [leaving, setLeaving] = useState(false);

  // Pull-to-refresh fans out to every live source on the home (server is source of truth).
  const refreshAll = (): void => {
    reloadMembers();
    reloadPoints();
    reloadSafety();
    reloadPresence();
    reloadBoard();
    reloadEvents();
    onChanged();
  };

  // The freshest active "come to me" point gets the rich compass card; the rest stay as compact rows.
  const primaryPoint = points[0] ?? null;
  const restPoints = points.slice(1);

  const count = group.memberCount;
  const leave = async (): Promise<void> => {
    setLeaving(true);
    try {
      await api.leaveGroup(group.id);
      onChanged();
    } catch {
      setLeaving(false);
    }
  };

  const sosMine = safetyPoints.some((p) => p.isMine);
  const sosOther = safetyPoints.find((p) => !p.isMine) ?? null;
  const hasSos = safetyPoints.length > 0;

  return (
    <>
      <AppHeader
        eyebrow={`${group.emoji ? `${group.emoji} ` : ""}${group.name} · ${count} ${count === 1 ? t("common.person") : t("common.people")}`}
        title={t("squad.title")}
        right={
          <button className="ava" aria-label={t("squad.inviteToSquad")} onClick={() => navigate(`/squad/invite/${group.id}`)}>
            <span className="ms">person_add</span>
          </button>
        }
      />
      <PullToRefresh onRefresh={refreshAll} />
      <div className="screen">
        {groups.length > 1 && (
          <div className="squad-switcher" role="tablist" aria-label={t("squad.yourSquads")}>
            {groups.map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={g.id === group.id}
                className={`squad-tab${g.id === group.id ? " on" : ""}`}
                onClick={() => onSelect(g.id)}
              >
                <span className="squad-tab-glyph">{g.emoji ?? "🎪"}</span>
                <span className="squad-tab-name">{g.name}</span>
                <span className="squad-tab-count">{g.memberCount}</span>
              </button>
            ))}
            <button className="squad-tab squad-tab-add" onClick={() => navigate("/squad/create")} aria-label={t("squad.newSquad")}>
              <span className="ms">add</span>
            </button>
          </div>
        )}

        {hasSos && (
          <button className="glass safety-home-banner" onClick={() => navigate(`/squad/${group.id}/safety`)}>
            <span className="safety-home-pulse">
              <span className="ms">{sosMine ? "share_location" : "sos"}</span>
            </span>
            <div className="safety-home-main">
              <div className="safety-home-title">
                {sosMine ? t("squad.sharingLocation") : t("squad.needsHelp", { name: sosOther?.createdByName ?? t("squad.aSquadmate") })}
              </div>
              <div className="safety-home-sub">
                {sosMine ? t("squad.sharingSub") : t("squad.needsHelpSub", { landmark: sosOther?.landmarkLabel ?? "" })}
              </div>
            </div>
            <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
          </button>
        )}

        <SquadNextUpCard groupId={group.id} events={events} points={points} presence={presence} />

        <button className="glass squad-plan-cta" onClick={() => navigate(`/squad/${group.id}/plan`)}>
          <div className="squad-plan-icon">
            <span className="ms">event_available</span>
          </div>
          <div className="squad-plan-main">
            <div className="squad-plan-title">{t("squad.buildPlan")}</div>
            <div className="squad-plan-sub">{t("squad.buildPlanSub")}</div>
          </div>
          <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
        </button>

        <WhereEveryoneCard groupId={group.id} presence={presence} />

        {primaryPoint ? (
          <MeetingCompassCard groupId={group.id} point={primaryPoint} />
        ) : (
          <button className="glass squad-plan-cta" onClick={() => navigate(`/squad/${group.id}/meet`)}>
            <div className="squad-plan-icon" style={{ background: "linear-gradient(135deg, #F5A623, #FFD060)" }}>
              <span className="ms">flag</span>
            </div>
            <div className="squad-plan-main">
              <div className="squad-plan-title">{t("squad.setMeetingPoint")}</div>
              <div className="squad-plan-sub">{t("squad.setMeetingPointSub")}</div>
            </div>
            <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
          </button>
        )}

        {restPoints.map((p) => (
          <MeetingPointCard key={p.id} groupId={group.id} point={p} />
        ))}

        {primaryPoint && (
          <button className="squad-inline-add" onClick={() => navigate(`/squad/${group.id}/meet`)}>
            <span className="ms" aria-hidden="true">add_location_alt</span>
            {t("squad.setAnotherPoint")}
          </button>
        )}

        <BoardPreviewCard groupId={group.id} notes={notes} loading={boardStatus === "loading"} />

        <SquadAgendaCard groupId={group.id} events={events} />

        {!hasSos && (
          <button className="glass squad-plan-cta squad-lost-cta" onClick={() => navigate(`/squad/${group.id}/safety`)}>
            <div className="squad-plan-icon" style={{ background: "linear-gradient(135deg, #2DB6A6, #3BD6C2)" }}>
              <span className="ms">volunteer_activism</span>
            </div>
            <div className="squad-plan-main">
              <div className="squad-plan-title">{t("squad.imLost")}</div>
              <div className="squad-plan-sub">{t("squad.imLostSub")}</div>
            </div>
            <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
          </button>
        )}

        <section className="glass members-card">
          <div className="members-head">
            <span className="label">{t("squad.members")}</span>
            <button
              className="members-invite"
              onClick={() => navigate(`/squad/invite/${group.id}`)}
            >
              <span className="ms" style={{ fontSize: 15 }}>
                person_add
              </span>
              {t("squad.invite")}
            </button>
          </div>
          <div className="members-list">
            {members.map((m) => (
              <div className="member-row" key={m.userId}>
                <Avatar url={m.avatarUrl} color={m.avatarColor} name={m.displayName} size={36} />
                <div className="member-main">
                  <div className="member-name">
                    {m.displayName ?? t("common.guest")}
                    {m.isYou && <span className="member-you"> · {t("common.you")}</span>}
                  </div>
                  <div className="member-sub">
                    {m.role === "owner" ? t("squad.createdSquad") : t("squad.memberRole")}
                  </div>
                </div>
                {m.role === "owner" && <span className="chip chip-accent-soft">{t("squad.owner")}</span>}
              </div>
            ))}
          </div>
        </section>

        <button className="btn btn-danger" onClick={leave} disabled={leaving}>
          <span className="ms">logout</span>
          {leaving ? t("squad.leaving") : t("squad.leaveSquad")}
        </button>
      </div>
    </>
  );
}

/** A live "come to me" meeting point on the squad home — opens the convergence detail (#26.3). */
function MeetingPointCard({ groupId, point }: { groupId: string; point: MeetingPointDto }): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const closesIn = closesInLabel(point.expiresAtUtc);
  const badge = lifecycleBadge(point.lifecycle);
  const owner = point.isMine ? t("squad.yourSpot") : t("squad.someonesSpot", { name: point.createdByName ?? t("squad.aSquadmate") });
  return (
    <button className="glass meet-active-card" onClick={() => navigate(`/squad/${groupId}/meet/${point.id}`)}>
      {point.photoUrl ? (
        <img className="meet-photo-thumb" src={point.photoUrl} alt="" />
      ) : (
        <div className="meet-active-icon">
          <span className="ms">flag</span>
        </div>
      )}
      <div className="meet-active-main">
        <div className="meet-active-title">{point.title}</div>
        <div className="meet-active-sub">
          {point.landmarkLabel}
          {point.note ? ` · "${point.note}"` : ""}
        </div>
        <div className="meet-active-meta">
          {owner} · {convergenceSummary(point)}
          {closesIn ? ` · ${closesIn}` : ""}
        </div>
      </div>
      <span className={`pill meet-badge meet-badge-${badge.tone}`}>{badge.label}</span>
    </button>
  );
}
