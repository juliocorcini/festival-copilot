/**
 * Squad tab (Pillar 3). Three states:
 *   • not signed in / no squad → empty hero (#23.1) routing into create / join,
 *   • in ≥1 squad             → group home (#23.7): plan CTA, member list, invite, leave.
 * Identity is Gate 4.1; groups + invites + members are Gate 4.2.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { api } from "../data/api";
import { useMyGroups, useGroup } from "../data/groups";
import { useMeetingPoints } from "../data/meetingPoints";
import { initialsOf, useIdentity } from "../data/identity";
import type { GroupDto, MeetingPointDto } from "../data/types";
import { LoadingState } from "../ui/states";
import { closesInLabel, convergenceSummary, lifecycleBadge } from "./meet/meetUi";

export function SquadScreen(): JSX.Element {
  const { hasProfile } = useIdentity();
  const { groups, status, reload } = useMyGroups();

  if (status === "loading") return <LoadingState rows={3} />;
  if (groups.length === 0) return <EmptySquad hasProfile={hasProfile} />;
  return <GroupHome group={groups[0]!} onChanged={reload} />;
}

function EmptySquad({ hasProfile }: { hasProfile: boolean }): JSX.Element {
  const navigate = useNavigate();
  const go = (target: string): void =>
    navigate(hasProfile ? target : `/squad/signin?next=${encodeURIComponent(target)}`);

  return (
    <>
      <AppHeader eyebrow="Together" title="Squad" />
      <div className="squad-empty">
        <div className="squad-hero">
          <div className="squad-hero-orb">
            <span className="ms">diversity_3</span>
          </div>
          <h2 className="poster">
            Festivals are
            <br />
            better together
          </h2>
          <p>
            Create a squad, build a shared plan, and find each other on the map — even when the
            signal dies and the battery's at 12%.
          </p>
        </div>
        <div className="squad-actions">
          <button className="btn btn-primary" onClick={() => go("/squad/create")}>
            <span className="ms">add</span>
            Create a squad
          </button>
          <button className="btn btn-ghost" onClick={() => go("/squad/join")}>
            <span className="ms">link</span>
            Join with a link or QR
          </button>
          <p className="squad-note">A quick account keeps your squad in sync — 5 seconds.</p>
        </div>
      </div>
    </>
  );
}

function GroupHome({ group, onChanged }: { group: GroupDto; onChanged: () => void }): JSX.Element {
  const navigate = useNavigate();
  const { members } = useGroup(group.id);
  const { points } = useMeetingPoints(group.id);
  const [leaving, setLeaving] = useState(false);

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

  return (
    <>
      <AppHeader
        eyebrow={`${group.emoji ? `${group.emoji} ` : ""}${group.name} · ${count} ${count === 1 ? "person" : "people"}`}
        title="Squad"
        right={
          <button className="ava" aria-label="Squad settings" onClick={() => navigate("/settings")}>
            <span className="ms">settings</span>
          </button>
        }
      />
      <div className="screen">
        <button className="glass squad-plan-cta" onClick={() => navigate(`/squad/${group.id}/plan`)}>
          <div className="squad-plan-icon">
            <span className="ms">event_available</span>
          </div>
          <div className="squad-plan-main">
            <div className="squad-plan-title">Build the squad plan</div>
            <div className="squad-plan-sub">See where everyone wants to be</div>
          </div>
          <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
        </button>

        <button className="glass squad-plan-cta" onClick={() => navigate(`/squad/${group.id}/where`)}>
          <div className="squad-plan-icon" style={{ background: "linear-gradient(135deg, #16A34A, #0EA5E9)" }}>
            <span className="ms">share_location</span>
          </div>
          <div className="squad-plan-main">
            <div className="squad-plan-title">Where's the squad</div>
            <div className="squad-plan-sub">Live map · who's at which stage</div>
          </div>
          <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
        </button>

        <button className="glass squad-plan-cta" onClick={() => navigate(`/squad/${group.id}/meet`)}>
          <div className="squad-plan-icon" style={{ background: "linear-gradient(135deg, #F5A623, #FFD060)" }}>
            <span className="ms">flag</span>
          </div>
          <div className="squad-plan-main">
            <div className="squad-plan-title">Set a meeting point</div>
            <div className="squad-plan-sub">Drop a spot for the squad to regroup</div>
          </div>
          <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
        </button>

        {points.map((p) => (
          <MeetingPointCard key={p.id} groupId={group.id} point={p} />
        ))}

        <button className="glass squad-plan-cta" onClick={() => navigate(`/squad/${group.id}/board`)}>
          <div className="squad-plan-icon" style={{ background: "linear-gradient(135deg, #8B5CF6, #6366F1)" }}>
            <span className="ms">push_pin</span>
          </div>
          <div className="squad-plan-main">
            <div className="squad-plan-title">Squad board</div>
            <div className="squad-plan-sub">Pinned notes, meet points, shout-outs</div>
          </div>
          <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
        </button>

        <section className="glass members-card">
          <div className="members-head">
            <span className="label">Members</span>
            <button
              className="members-invite"
              onClick={() => navigate(`/squad/invite/${group.id}`)}
            >
              <span className="ms" style={{ fontSize: 15 }}>
                person_add
              </span>
              Invite
            </button>
          </div>
          <div className="members-list">
            {members.map((m) => (
              <div className="member-row" key={m.userId}>
                <span
                  className="ava"
                  style={{
                    width: 36,
                    height: 36,
                    fontSize: 11,
                    background: m.avatarColor
                      ? `linear-gradient(135deg, ${m.avatarColor}, ${m.avatarColor}cc)`
                      : "linear-gradient(135deg, #6B7280, #6B7280cc)",
                    color: "#0F0D09",
                  }}
                >
                  {initialsOf(m.displayName)}
                </span>
                <div className="member-main">
                  <div className="member-name">
                    {m.displayName ?? "Guest"}
                    {m.isYou && <span className="member-you"> · you</span>}
                  </div>
                  <div className="member-sub">
                    {m.role === "owner" ? "Created the squad" : "Member"}
                  </div>
                </div>
                {m.role === "owner" && <span className="chip chip-accent-soft">Owner</span>}
              </div>
            ))}
          </div>
        </section>

        <button className="btn btn-danger" onClick={leave} disabled={leaving}>
          <span className="ms">logout</span>
          {leaving ? "Leaving…" : "Leave squad"}
        </button>
      </div>
    </>
  );
}

/** A live "come to me" meeting point on the squad home — opens the convergence detail (#26.3). */
function MeetingPointCard({ groupId, point }: { groupId: string; point: MeetingPointDto }): JSX.Element {
  const navigate = useNavigate();
  const closesIn = closesInLabel(point.expiresAtUtc);
  const badge = lifecycleBadge(point.lifecycle);
  return (
    <button className="glass meet-active-card" onClick={() => navigate(`/squad/${groupId}/meet/${point.id}`)}>
      <div className="meet-active-icon">
        <span className="ms">flag</span>
      </div>
      <div className="meet-active-main">
        <div className="meet-active-title">{point.title}</div>
        <div className="meet-active-sub">
          {point.landmarkLabel}
          {point.note ? ` · "${point.note}"` : ""}
        </div>
        <div className="meet-active-meta">
          {convergenceSummary(point)}
          {closesIn ? ` · ${closesIn}` : ""}
        </div>
      </div>
      <span className={`pill meet-badge meet-badge-${badge.tone}`}>{badge.label}</span>
    </button>
  );
}
