/**
 * Squad plan overview (#24.1, with the needs-input state #24.6). The auto-built group timetable:
 * per-set blocks from everyone's locked picks (plurality → favorited → owner), each tagged with
 * YOUR status (following / your own / locked-conflict). Tap a block to adjust. Splitting is shown,
 * never fought (DEC-013/019). The aggregation is pure (`buildSquadPlan`); this is presentation only.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useGroup } from "../../data/groups";
import { useGroupEvents } from "../../data/groupEvents";
import { useOnboarding } from "../../data/localStore";
import { useLivePlanSync, useSquadPlan, useSquadPlanNotice, type SquadPlanNotice } from "../../data/squadPlan";
import { useLineup } from "../../data/useLineup";
import type { SquadBlock } from "../../domain/squadPlan";
import { eventClashLabel, eventsForDay, mergeSquadTimeline, type TimelineEvent } from "../../domain/squadTimeline";
import { daysForWeekends } from "../../lib/festival";
import { stageColor, timeInZone } from "../../lib/format";
import { useT } from "../../i18n";
import { ErrorState, LoadingState } from "../../ui/states";
import { CreateEventSheet } from "./CreateEventSheet";
import { durationLabel, eventLifecycleFromIso } from "./eventsUi";
import { blockSummary, StatusPill } from "./squadUi";

export function SquadPlanScreen(): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
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
  const { events, reload: reloadEvents } = useGroupEvents(id);
  // E07/DEC-095: keep my shared plan live for the active day, and surface what teammates changed.
  useLivePlanSync(id);
  const notice = useSquadPlanNotice(id);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  // E21: pin a fixed-time "squad moment" from the plan itself — reuses the agenda's create flow. The
  // event lands on the group-events lane the timeline interleaves; it NEVER feeds the set aggregation.
  const [creating, setCreating] = useState(false);
  const eventTz = lineup.lineup?.festival.timezone ?? timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const eventStages = lineup.lineup?.stages ?? [];

  const count = group?.memberCount ?? raw?.memberCount ?? 0;
  const meShared = raw?.members.find((m) => m.isYou)?.shared ?? false;

  const header = (
    <header className="appbar squad-plan-bar">
      <button className="ava ghost-ava" aria-label={t("common.back")} onClick={() => navigate("/squad")}>
        <span className="ms">arrow_back</span>
      </button>
      <div className="squad-plan-head">
        <div className="eyebrow">
          {group
            ? `${group.emoji ? `${group.emoji} ` : ""}${group.name} · ${count} ${count === 1 ? t("common.person") : t("common.people")}`
            : t("squad.title")}
        </div>
        <h1 className="poster">{t("squad.planTitle")}</h1>
      </div>
      <button className="ava ghost-ava" aria-label={t("squad.refreshPlan")} onClick={reload}>
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
        <ErrorState message={t("squad.planLoadError")} onRetry={reload} />
      </>
    );
  }

  // F02/DEC-110: filter events to those belonging to the active day before interleaving.
  const dayEvents = useMemo(() => {
    if (!dayKey || days.length === 0) return events;
    const idx = days.findIndex((d) => d.key === dayKey);
    if (idx < 0) return events;
    const dayStart = days[idx]!.startMs;
    const dayEnd = idx + 1 < days.length ? days[idx + 1]!.startMs : Infinity;
    return eventsForDay(events, dayStart, dayEnd);
  }, [events, dayKey, days]);

  // Render-only interleave of the aggregated sets (buildSquadPlan — untouched) with the group agenda
  // (D23). The aggregation never sees an event; this only orders them for display.
  const timeline = mergeSquadTimeline(plan.blocks, dayEvents);

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
        <p className="squad-plan-hint">{t("squad.planHint")}</p>

        <button
          className={`squad-history-entry glass${notice.count > 0 ? " has-news" : ""}`}
          onClick={() => navigate(`/squad/${id}/plan/history`)}
        >
          <span className="ms">{notice.count > 0 ? "notifications_active" : "history"}</span>
          <div className="squad-history-entry-main">
            <div className="squad-history-entry-title">
              {notice.count > 0 ? planNoticeText(notice, t) : t("squad.planHistory")}
            </div>
            <div className="squad-history-entry-sub">
              {meShared ? t("squad.liveShareOn") : t("squad.planHistorySub")}
            </div>
          </div>
          {notice.count > 0 ? (
            <span className="squad-history-badge">{notice.count}</span>
          ) : (
            <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
          )}
        </button>

        {!meShared && (
          <button className="squad-share-cta" onClick={() => navigate(`/squad/${id}/share`)}>
            <span className="ms">ios_share</span>
            <div className="squad-share-main">
              <div className="squad-share-title">{t("squad.shareYourPlan")}</div>
              <div className="squad-share-sub">{t("squad.planShareSub")}</div>
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
            <div className="squad-plan-empty-title">{t("squad.notEnoughTitle")}</div>
            <p>{t("squad.planBuilds")} {meShared ? t("squad.waitingSquad") : t("squad.startSharing")}</p>
            {!meShared && (
              <button className="btn btn-primary" onClick={() => navigate(`/squad/${id}/share`)}>
                <span className="ms">ios_share</span>
                {t("squad.shareMyPlan")}
              </button>
            )}
          </div>
        ) : (
          <div className="plan-tl squad-tl">
            <div className="plan-tl-line" />
            {timeline.map((item, i) =>
              item.kind === "set" ? (
                <SquadSetRow
                  key={`s-${item.block.set.id}`}
                  block={item.block}
                  i={i}
                  memberCount={plan.memberCount}
                  timezone={timezone}
                  now={now}
                  onOpen={() => navigate(`/squad/${id}/plan/${item.block.set.id}?day=${encodeURIComponent(dayKey ?? "")}`)}
                />
              ) : (
                <SquadEventRow
                  key={`e-${item.event.id}`}
                  event={item.event}
                  i={i}
                  timezone={timezone}
                  now={now}
                  clashLabel={eventClashLabel(item.event, plan.blocks)}
                  onOpen={() => navigate(`/squad/${id}/events`)}
                />
              )
            )}
          </div>
        )}

        <button className="glass squad-add-moment" onClick={() => setCreating(true)}>
          <span className="ms squad-add-moment-ico" aria-hidden="true">add_circle</span>
          <span className="squad-add-moment-main">
            <span className="squad-add-moment-title">{t("squad.addMoment")}</span>
            <span className="squad-add-moment-sub">{t("squad.addMomentSub")}</span>
          </span>
        </button>
      </div>

      {creating && id && (
        <CreateEventSheet
          groupId={id}
          tz={eventTz}
          stages={eventStages}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reloadEvents();
          }}
        />
      )}
    </>
  );
}

/** A squad set on the shared timeline — the My Plan rail/dot/card recipe (D22), with group extras. */
function SquadSetRow({
  block,
  i,
  memberCount,
  timezone,
  now,
  onOpen,
}: {
  block: SquadBlock;
  i: number;
  memberCount: number;
  timezone: string;
  now: number;
  onOpen: () => void;
}): JSX.Element {
  const t = useT();
  const { startMs, endMs } = block.set;
  const status = now >= endMs ? "done" : now >= startMs ? "now" : "";
  const conflict = block.youStatus === "conflict";
  return (
    <div className="plan-row fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className={`plan-dot ${status}`} />
      <button
        className={`glass plan-card squad-tl-card tappable ${status}${conflict ? " conflict" : ""}`}
        onClick={onOpen}
      >
        <div className="plan-card-main">
          <div className={`plan-when ${status}`}>
            {timeInZone(new Date(startMs).toISOString(), timezone)} – {timeInZone(new Date(endMs).toISOString(), timezone)}
          </div>
          <div className="poster plan-name">
            {block.set.label}
            {block.pinned && (
              <span className="ms squad-block-pin" title={t("squad.methodOwnerPin")}>push_pin</span>
            )}
          </div>
          <div className="plan-stage">
            <span className="dot" style={{ background: stageColor(block.set.stageName) }} />
            {blockSummary(block, memberCount, t)}
          </div>
        </div>
        <StatusPill block={block} />
      </button>
    </div>
  );
}

/** A group event interleaved between the sets (D23 — render-only). Distinct icon card on the same
 *  rail; an overlap with a set is a LABEL ("during {set}"), never a resolution. Tap opens the agenda. */
function SquadEventRow({
  event,
  i,
  timezone,
  now,
  clashLabel,
  onOpen,
}: {
  event: TimelineEvent;
  i: number;
  timezone: string;
  now: number;
  clashLabel: string | null;
  onOpen: () => void;
}): JSX.Element {
  const t = useT();
  const lifecycle = eventLifecycleFromIso(event.startsAtUtc, event.endsAtUtc, now);
  const live = lifecycle === "live";
  const done = lifecycle === "past";
  const startMs = Date.parse(event.startsAtUtc);
  const timing = live ? t("squad.liveNow") : done ? "" : t("squad.inTime", { time: durationLabel((startMs - now) / 60_000) });
  return (
    <div className="plan-row fp-rise" style={{ "--i": i } as CSSProperties}>
      <span className={`plan-dot mini squad-tl-event-dot${live ? " now" : ""}`} />
      <button className={`glass plan-card squad-tl-event tappable${done ? " done" : ""}${live ? " now" : ""}`} onClick={onOpen}>
        <span className="ms squad-tl-event-ico" aria-hidden="true">event</span>
        <div className="plan-card-main">
          <div className="plan-when">
            {timeInZone(event.startsAtUtc, timezone)}
            {timing ? ` · ${timing}` : ""}
          </div>
          <div className="squad-tl-event-title">{event.title}</div>
          {clashLabel && <div className="plan-stage">{t("squad.duringSet", { label: clashLabel })}</div>}
        </div>
        <span className="ms squad-card-chev" aria-hidden="true">chevron_right</span>
      </button>
    </div>
  );
}

/** One-line "what changed" summary for the history entry — single actor named, otherwise a count. */
function planNoticeText(notice: SquadPlanNotice, t: ReturnType<typeof useT>): string {
  if (notice.count > 1) return t("planNotice.many", { count: notice.count });
  const c = notice.latest;
  const name = c?.actorName ?? t("common.guest");
  return c?.kind === "unshare" ? t("planNotice.unshared", { name }) : t("planNotice.updated", { name });
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
  const t = useT();
  const pct = total > 0 ? Math.round((shared / total) * 100) : 0;
  return (
    <div className="squad-needs">
      <div className="squad-needs-head">
        <div className="squad-needs-title">{t("squad.sharedOfTotal", { shared, total })}</div>
        <span className="squad-needs-pct">{pct}%</span>
      </div>
      <div className="squad-tally">
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="squad-needs-copy">{t("squad.nudgeCopy")}</p>
      <button className="chip chip-accent squad-needs-nudge" onClick={() => navigate(inviteHref)}>
        <span className="ms" style={{ fontSize: 14 }}>person_add</span>
        {t("squad.inviteNudge")}
      </button>
    </div>
  );
}
