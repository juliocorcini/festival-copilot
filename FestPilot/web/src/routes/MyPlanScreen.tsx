/**
 * A7 My Plan (#21, DEC-018/029): the locked plan as a polished vertical timeline — done / now /
 * upcoming sets on a gradient rail, with walk chips between stages and break chips for long idles.
 * Reads the locally-saved plan (DEC-041); the timeline math is pure (`domain/plan.ts`). Empty days
 * route into Lock in. Share uses the Web Share API with a clipboard fallback.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { useOnboarding, usePlan } from "../data/localStore";
import { useLineup } from "../data/useLineup";
import { buildPlanTimeline, type PlanGapItem, type PlanSetItem } from "../domain/plan";
import { daysForWeekends } from "../lib/festival";
import { stageColor, timeInZone } from "../lib/format";
import { sharePlan } from "../lib/share";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { ErrorState, LoadingState } from "../ui/states";

export function MyPlanScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { onboarding } = useOnboarding();
  const travel = useTravelMatrix(lineup);
  const tz = lineup?.festival.timezone ?? "UTC";

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const allDays = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds) : []), [lineup, weekendIds]);
  const days = useMemo(() => {
    const picked = onboarding?.dayKeys ?? [];
    return picked.length > 0 ? allDays.filter((d) => picked.includes(d.key)) : allDays;
  }, [allDays, onboarding?.dayKeys]);

  const dayKey = params.get("day") ?? days[0]?.key ?? null;
  const day = days.find((d) => d.key === dayKey) ?? null;
  const plan = usePlan(lineup?.festival.id, dayKey ?? undefined);

  const timeline = useMemo(
    () => buildPlanTimeline(plan.plan?.slots ?? [], travel, now),
    [plan.plan?.slots, travel, now]
  );

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup) {
    return (
      <>
        <AppHeader eyebrow="Your day" title="My Plan" />
        <ErrorState message={error ?? "Could not load your plan."} onRetry={reload} />
      </>
    );
  }

  const title = day ? `${day.weekdayLong} ${dayOfMonth(day.startMs, tz)}` : "My Plan";
  const hasPlan = timeline.setCount > 0;
  const selectDay = (key: string): void => setParams(key ? { day: key } : {}, { replace: true });

  return (
    <>
      <AppHeader
        eyebrow="My Plan"
        title={title}
        right={
          hasPlan ? (
            <button
              className="ava-sm"
              aria-label="Share plan"
              onClick={() => void sharePlan(title, plan.plan!.slots, tz)}
            >
              <span className="ms" style={{ color: "var(--accent)", fontSize: 19 }}>ios_share</span>
            </button>
          ) : undefined
        }
      />

      {days.length > 1 && (
        <div className="plan-days">
          {days.map((d) => (
            <button
              key={d.key}
              className={`pill${d.key === dayKey ? " on" : " ghost"}`}
              onClick={() => selectDay(d.key)}
            >
              {d.weekdayShort} {dayOfMonth(d.startMs, tz)}
            </button>
          ))}
          {hasPlan && (
            <span className="plan-summary">
              {timeline.setCount} set{timeline.setCount === 1 ? "" : "s"}
              {timeline.breakCount > 0 ? ` · ${timeline.breakCount} break${timeline.breakCount === 1 ? "" : "s"}` : ""}
            </span>
          )}
        </div>
      )}

      {!hasPlan ? (
        <div className="state">
          <span className="ms">event_available</span>
          <h2>No plan yet</h2>
          <p>Lock in your favorites and we’ll build a clash-free timeline for {day ? day.weekdayLong : "the day"}.</p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/lockin${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
          >
            <span className="ms">lock</span> Lock in my day
          </button>
        </div>
      ) : (
        <div className="plan-scroll">
          <div className="plan-tl">
            <div className="plan-tl-line" />
            {timeline.items.map((item, index) =>
              item.kind === "set" ? (
                <PlanSetRow key={item.slot.setId} item={item} tz={tz} onNavigate={() => navigate("/map")} />
              ) : (
                <PlanGapRow key={`gap-${index}`} item={item} />
              )
            )}
            <div className="plan-row">
              <span className="plan-dot mini" />
              <button className="plan-chip" onClick={() => navigate("/timetable")}>
                <span className="ms" style={{ fontSize: 14 }}>add</span> Add a set
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlanSetRow({ item, tz, onNavigate }: { item: PlanSetItem; tz: string; onNavigate: () => void }): JSX.Element {
  const { slot, status, endMs } = item;
  const start = timeInZone(new Date(slot.startMs).toISOString(), tz);
  const end = timeInZone(new Date(endMs).toISOString(), tz);
  const color = stageColor(slot.stageName);
  return (
    <div className="plan-row">
      <span className={`plan-dot ${status}`} />
      <div className={`glass plan-card ${status}`}>
        <div className="plan-card-main">
          <div className={`plan-when ${status}`}>
            {status === "now" ? "NOW · " : ""}
            {start} – {end}
            {status === "done" ? " · done" : ""}
            {slot.cutMs != null ? " · left early" : ""}
          </div>
          <div className="poster plan-name">{slot.label}</div>
          <div className="plan-stage">
            <span className="dot" style={{ background: color }} />
            {slot.stageName}
          </div>
        </div>
        {status === "now" ? (
          <button className="plan-go" aria-label="Navigate to stage" onClick={onNavigate}>
            <span className="ms" style={{ fontSize: 15 }}>near_me</span>
          </button>
        ) : (
          <span className="ms plan-state-ico" style={{ color: status === "done" ? "var(--accent)" : "var(--muted)" }}>
            {status === "done" ? "check_circle" : "radio_button_unchecked"}
          </span>
        )}
      </div>
    </div>
  );
}

function PlanGapRow({ item }: { item: PlanGapItem }): JSX.Element {
  return (
    <div className="plan-row gap">
      <span className="plan-dot mini" />
      <div className="plan-chips">
        {item.walkMinutes > 0 && (
          <span className="plan-chip">
            <span className="ms" style={{ fontSize: 13 }}>directions_walk</span>
            {item.walkMinutes} min walk to {item.toStageName}
          </span>
        )}
        {item.breakMinutes >= 20 && (
          <span className="plan-chip">
            <span className="ms" style={{ fontSize: 13 }}>restaurant</span>
            {item.breakMinutes} min break
          </span>
        )}
      </div>
    </div>
  );
}

function dayOfMonth(startMs: number, timeZone: string): string {
  if (!Number.isFinite(startMs)) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone }).format(startMs);
}
