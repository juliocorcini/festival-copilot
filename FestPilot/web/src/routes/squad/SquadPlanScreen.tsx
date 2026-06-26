/**
 * Squad plan overview (#24.1, with the needs-input state #24.6). The auto-built group timetable:
 * per-set blocks from everyone's locked picks (plurality → favorited → owner), each tagged with
 * YOUR status (following / your own / locked-conflict). Tap a block to adjust. Splitting is shown,
 * never fought (DEC-013/019). The aggregation is pure (`buildSquadPlan`); this is presentation only.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGroup } from "../../data/groups";
import { useGroupEvents } from "../../data/groupEvents";
import { useOnboarding } from "../../data/localStore";
import { useSquadPlan } from "../../data/squadPlan";
import { useLineup } from "../../data/useLineup";
import type { SquadBlock } from "../../domain/squadPlan";
import type { GroupEventDto } from "../../data/types";
import { daysForWeekends } from "../../lib/festival";
import { stageColor, timeInZone } from "../../lib/format";
import { ErrorState, LoadingState } from "../../ui/states";
import { eventBadge, eventCountdown, eventLifecycleFromIso } from "./eventsUi";
import { blockSummary, StatusPill } from "./squadUi";

export function SquadPlanScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { group } = useGroup(id);
  const lineup = useLineup();
  const { onboarding } = useOnboarding();
  const [params, setParams] = useSearchParams();

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const allDays = useMemo(() => (lineup.lineup ? daysForWeekends(lineup.lineup, weekendIds) : []), [lineup.lineup, weekendIds]);
  const days = useMemo(() => {
    const picked = onboarding?.dayKeys ?? [];
    return picked.length > 0 ? allDays.filter((d) => picked.includes(d.key)) : allDays;
  }, [allDays, onboarding?.dayKeys]);

  const dayKey = params.get("day") ?? days[0]?.key;
  const { plan, raw, status, timezone, reload } = useSquadPlan(id, dayKey);
  const { events } = useGroupEvents(id);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const count = group?.memberCount ?? raw?.memberCount ?? 0;
  const meShared = raw?.members.find((m) => m.isYou)?.shared ?? false;

  const header = (
    <header className="appbar squad-plan-bar">
      <button className="ava ghost-ava" aria-label="Back" onClick={() => navigate("/squad")}>
        <span className="ms">arrow_back</span>
      </button>
      <div className="squad-plan-head">
        <div className="eyebrow">
          {group ? `${group.emoji ? `${group.emoji} ` : ""}${group.name} · ${count} ${count === 1 ? "person" : "people"}` : "Squad"}
        </div>
        <h1 className="poster">Squad plan</h1>
      </div>
      <button className="ava ghost-ava" aria-label="Refresh squad plan" onClick={reload}>
        <span className="ms" style={{ color: "var(--accent)" }}>refresh</span>
      </button>
    </header>
  );

  if (status === "loading") {
    return (
      <>
        {header}
        <LoadingState rows={4} />
      </>
    );
  }
  if (status === "error" || !plan) {
    return (
      <>
        {header}
        <ErrorState message="Could not load the squad plan." onRetry={reload} />
      </>
    );
  }

  const firstUpcoming = plan.blocks.findIndex((b) => b.set.startMs > now);
  const hasPast = plan.blocks.some((b) => b.set.startMs <= now);
  const showNowAt = hasPast && firstUpcoming > 0 ? firstUpcoming : -1;

  return (
    <>
      {header}
      <div className="screen squad-plan">
        {days.length > 1 && (
          <div className="seg squad-day-seg">
            {days.map((d) => (
              <button
                key={d.key}
                className={d.key === dayKey ? "on" : ""}
                onClick={() => setParams({ day: d.key }, { replace: true })}
              >
                {d.weekdayShort}
              </button>
            ))}
          </div>
        )}
        <p className="squad-plan-hint">Auto-built from everyone's locked picks · tap a block to adjust</p>

        {events.length > 0 && <AgendaBand events={events} timezone={timezone} now={now} onOpen={() => navigate(`/squad/${id}/events`)} />}

        {!meShared && (
          <button className="squad-share-cta" onClick={() => navigate(`/squad/${id}/share`)}>
            <span className="ms">ios_share</span>
            <div className="squad-share-main">
              <div className="squad-share-title">Share your plan</div>
              <div className="squad-share-sub">Add your locked picks so the squad plan sharpens</div>
            </div>
            <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
          </button>
        )}

        {plan.sharedCount < plan.memberCount && (
          <NeedsInput
            shared={plan.sharedCount}
            total={plan.memberCount}
            onNudge={() => navigate(`/squad/${id}/invite/${id}`)}
            inviteHref={`/squad/invite/${id}`}
            navigate={navigate}
          />
        )}

        {plan.blocks.length === 0 ? (
          <div className="squad-plan-empty glass">
            <span className="ms">hourglass_empty</span>
            <div className="squad-plan-empty-title">Not enough picks yet</div>
            <p>The squad plan builds itself as friends lock in and share. {meShared ? "Waiting on the squad." : "Start by sharing yours."}</p>
            {!meShared && (
              <button className="btn btn-primary" onClick={() => navigate(`/squad/${id}/share`)}>
                <span className="ms">ios_share</span>
                Share my plan
              </button>
            )}
          </div>
        ) : (
          <div className="squad-blocks">
            {plan.blocks.map((block, i) => (
              <div key={block.set.id}>
                {showNowAt === i && (
                  <div className="squad-now">
                    <span>NOW · {timeInZone(new Date(now).toISOString(), timezone)}</span>
                    <span className="squad-now-line" />
                  </div>
                )}
                <BlockRow
                  block={block}
                  memberCount={plan.memberCount}
                  timezone={timezone}
                  onOpen={() => navigate(`/squad/${id}/plan/${block.set.id}?day=${encodeURIComponent(dayKey ?? "")}`)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function BlockRow({
  block,
  memberCount,
  timezone,
  onOpen,
}: {
  block: SquadBlock;
  memberCount: number;
  timezone: string;
  onOpen: () => void;
}): JSX.Element {
  const conflict = block.youStatus === "conflict";
  return (
    <button className={`glass squad-block${conflict ? " conflict" : ""}`} onClick={onOpen}>
      <span className="squad-block-time poster">{timeInZone(new Date(block.set.startMs).toISOString(), timezone)}</span>
      <div className="squad-block-main">
        <div className="squad-block-act">
          <span className="dot" style={{ background: stageColor(block.set.stageName) }} />
          <span className="squad-block-name">{block.set.label}</span>
          {block.pinned && (
            <span className="ms squad-block-pin" title="Owner pick">push_pin</span>
          )}
        </div>
        <div className="squad-block-sub">{blockSummary(block, memberCount)}</div>
      </div>
      <StatusPill block={block} />
    </button>
  );
}

/** A glanceable strip of the squad's fixed-time moments (Phase 8). A layer ALONGSIDE the set plan —
 *  it renders next to the blocks, never inside the aggregation. Tap opens the full agenda. */
function AgendaBand({
  events,
  timezone,
  now,
  onOpen,
}: {
  events: GroupEventDto[];
  timezone: string;
  now: number;
  onOpen: () => void;
}): JSX.Element {
  return (
    <button className="glass squad-agenda-band" onClick={onOpen}>
      <div className="squad-agenda-band-head">
        <span className="ms" aria-hidden="true">event</span>
        <span className="squad-agenda-band-title">Squad agenda</span>
        <span className="ms squad-agenda-band-chev" aria-hidden="true">chevron_right</span>
      </div>
      <div className="squad-agenda-band-rows">
        {events.slice(0, 3).map((ev) => {
          const lifecycle = eventLifecycleFromIso(ev.startsAtUtc, ev.endsAtUtc, now);
          const badge = eventBadge(lifecycle);
          return (
            <div className={`squad-agenda-chip${lifecycle === "live" ? " is-live" : ""}`} key={ev.id}>
              <span className="squad-agenda-chip-time">{timeInZone(ev.startsAtUtc, timezone)}</span>
              <span className="squad-agenda-chip-title">{ev.title}</span>
              <span className={`pill meet-badge meet-badge-${badge.tone}`}>{eventCountdown(ev.startsAtUtc, ev.endsAtUtc, now)}</span>
            </div>
          );
        })}
      </div>
    </button>
  );
}

function NeedsInput({
  shared,
  total,
  navigate,
  inviteHref,
}: {
  shared: number;
  total: number;
  onNudge: () => void;
  inviteHref: string;
  navigate: (to: string) => void;
}): JSX.Element {
  const pct = total > 0 ? Math.round((shared / total) * 100) : 0;
  return (
    <div className="squad-needs">
      <div className="squad-needs-head">
        <div className="squad-needs-title">
          {shared} of {total} shared a plan
        </div>
        <span className="squad-needs-pct">{pct}%</span>
      </div>
      <div className="squad-tally">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="squad-needs-copy">The squad plan sharpens as more friends lock in. Nudge the rest:</p>
      <button className="chip chip-accent squad-needs-nudge" onClick={() => navigate(inviteHref)}>
        <span className="ms" style={{ fontSize: 14 }}>person_add</span>
        Invite &amp; nudge
      </button>
    </div>
  );
}
