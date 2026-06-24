/**
 * A2 "Now & Next" home (#18, UC-12/DEC-022). When the festival is running and the user has a locked
 * plan for the active day, the hero is plan-driven: what's on NOW, a live **LEAVE IN** countdown to
 * the next set (start − walk, via the real travel matrix), an elapsed progress bar and a compact
 * walk line. Otherwise (pre-festival / no plan) it falls back to the lineup: NEXT UP + a DOORS-IN
 * day countdown. The math lives in `domain/nowNext.ts`; this screen only renders it.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { ErrorState, EmptyState, LoadingState } from "../ui/states";
import { useLineup } from "../data/useLineup";
import { useOnboarding, usePlan } from "../data/localStore";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { buildNowNext } from "../domain/nowNext";
import { imageByActKey } from "../domain/lineup";
import { daysForWeekends } from "../lib/festival";
import { dayLabel, daysUntil, stageColor, timeInZone } from "../lib/format";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import type { PerformanceDto } from "../data/types";
import type { PlanSlot } from "../domain/types";

const ms = (iso: string | null): number => (iso ? Date.parse(iso) : NaN);

export function NowScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const { onboarding } = useOnboarding();
  const travel = useTravelMatrix(lineup);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const weekendIds = useMemo(() => onboarding?.weekendIds ?? [], [onboarding?.weekendIds]);
  const days = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds) : []), [lineup, weekendIds]);
  const activeDay = useMemo(() => {
    if (days.length === 0) return null;
    let chosen = days[0]!;
    for (const day of days) {
      if (day.startMs <= now) chosen = day;
      else break;
    }
    return chosen;
  }, [days, now]);
  const plan = usePlan(lineup?.festival.id, activeDay?.key);

  const model = useMemo(() => {
    if (!lineup) return null;
    const stageName = new Map(lineup.stages.map((s) => [s.id, s.name] as const));
    const timed = lineup.performances
      .filter((p) => p.startAtUtc && p.endAtUtc)
      .sort((a, b) => ms(a.startAtUtc) - ms(b.startAtUtc));
    const live = timed.find((p) => ms(p.startAtUtc) <= now && now < ms(p.endAtUtc)) ?? null;
    const upcoming = timed.filter((p) => ms(p.startAtUtc) > now);
    const hero = live ?? upcoming[0] ?? timed[0] ?? null;
    const after = hero ? timed.filter((p) => ms(p.startAtUtc) > ms(hero.startAtUtc)) : [];
    return {
      tz: lineup.festival.timezone,
      festivalName: lineup.festival.name,
      stageName: (id: string | null) => (id ? stageName.get(id) ?? "" : ""),
      isLive: Boolean(live),
      hero,
      next: after[0] ?? null,
      later: after.slice(0, 7),
      totalCount: timed.length,
    };
  }, [lineup, now]);

  const nowNext = useMemo(
    () => (plan.plan && plan.plan.slots.length > 0 ? buildNowNext(plan.plan.slots, travel, now) : null),
    [plan.plan, travel, now]
  );

  const photoByKey = useMemo(() => imageByActKey(lineup?.performances ?? []), [lineup]);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !model) {
    return (
      <>
        <AppHeader eyebrow="FestPilot" title="Now & Next" />
        <ErrorState message={error ?? "Could not load the lineup."} onRetry={reload} />
      </>
    );
  }

  const { hero, tz } = model;
  const eyebrow = hero ? `${shorten(model.festivalName)} · ${dayLabel(hero.startAtUtc, tz)}` : shorten(model.festivalName);

  if (!hero) {
    return (
      <>
        <AppHeader eyebrow={eyebrow} title="Now & Next" />
        <EmptyState icon="calendar_month" title="Lineup coming soon" message="Sets will appear here as soon as the schedule is published." />
      </>
    );
  }

  // In-festival + a locked plan with a live set → the rich, plan-driven hero (LEAVE IN + walk).
  if (model.isLive && nowNext?.live) {
    return (
      <>
        <AppHeader eyebrow={eyebrow} title="Now & Next" />
        <div className="screen">
          <PlanHero nn={nowNext} tz={tz} dayKey={activeDay?.key ?? null} photoByKey={photoByKey} />
          {nowNext.later.length > 0 && <LaterList rows={nowNext.later.slice(0, 6)} tz={tz} photoByKey={photoByKey} />}
          <p className="src" style={{ textAlign: "center" }}>
            From your locked plan · {model.totalCount} sets in the lineup
          </p>
        </div>
      </>
    );
  }

  const days_ = daysUntil(hero.startAtUtc);

  return (
    <>
      <AppHeader eyebrow={eyebrow} title="Now & Next" />
      <div className="screen">
        <section className="glass accent now-hero">
          <div className="blob" />
          <ArtistPhoto
            src={hero.artists[0]?.imageUrl ?? null}
            name={performanceName(hero)}
            width={PHOTO_WIDTH.card}
            className="now-hero-photo"
          />
          <div className="now-tag" style={{ color: model.isLive ? "var(--ok-ink)" : "var(--accent2)" }}>
            {model.isLive ? <span className="live" /> : <span className="ms" style={{ fontSize: 14 }}>schedule</span>}
            {model.isLive ? "NOW" : "NEXT UP"}
          </div>
          <div className="now-title poster">{performanceName(hero)}</div>
          <div className="now-stage">
            <span className="dot" style={{ background: stageColor(model.stageName(hero.stageId)) }} />
            {model.stageName(hero.stageId) || "TBA"}
            <span style={{ marginLeft: "auto", color: "var(--accent2)", fontWeight: 700 }}>{timeInZone(hero.startAtUtc, tz)}</span>
          </div>

          {!model.isLive && days_ > 0 && (
            <div className="now-foot">
              <div>
                <div className="now-next-label">DOORS IN</div>
                <div className="big-count">
                  {days_}
                  <span style={{ fontSize: 18 }}>{days_ === 1 ? "day" : "days"}</span>
                </div>
              </div>
              {model.next && (
                <div style={{ textAlign: "right" }}>
                  <div className="now-next-label">then</div>
                  <div className="now-next-name poster">{performanceName(model.next)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {model.stageName(model.next.stageId)} · {timeInZone(model.next.startAtUtc, tz)}
                  </div>
                </div>
              )}
            </div>
          )}

          {model.isLive && model.next && (
            <div className="now-foot">
              <div>
                <div className="now-next-label">next up</div>
                <div className="now-next-name poster">{performanceName(model.next)}</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: "var(--muted)" }}>
                {model.stageName(model.next.stageId)} · {timeInZone(model.next.startAtUtc, tz)}
              </div>
            </div>
          )}
        </section>

        {model.later.length > 0 && (
          <section className="glass list-card">
            <span className="label">Up next</span>
            {model.later.map((p) => (
              <div key={p.id} className="lineup-row">
                <span className="t">{timeInZone(p.startAtUtc, tz)}</span>
                <ArtistPhoto
                  src={p.artists[0]?.imageUrl ?? null}
                  name={performanceName(p)}
                  width={PHOTO_WIDTH.avatar}
                  className="row-photo"
                />
                <span className="dot" style={{ background: stageColor(model.stageName(p.stageId)) }} />
                <span className="n">{performanceName(p)}</span>
                <span className="s">{model.stageName(p.stageId)}</span>
              </div>
            ))}
          </section>
        )}

        <p className="src" style={{ textAlign: "center" }}>
          {model.totalCount} sets across the lineup · live from the API
        </p>
      </div>
    </>
  );
}

function PlanHero({
  nn,
  tz,
  dayKey,
  photoByKey,
}: {
  nn: NonNullable<ReturnType<typeof buildNowNext>>;
  tz: string;
  dayKey: string | null;
  photoByKey: Map<string, string | null>;
}): JSX.Element {
  const navigate = useNavigate();
  const live = nn.live!;
  const leave = nn.leaveInMinutes;
  return (
    <section className="glass accent now-hero">
      <div className="blob" />
      <ArtistPhoto
        src={photoByKey.get(live.actKey) ?? null}
        name={live.label}
        width={PHOTO_WIDTH.card}
        className="now-hero-photo"
      />
      <div className="now-tag" style={{ color: "var(--ok-ink)" }}>
        <span className="live" />
        NOW
      </div>
      <div className="now-title poster">{live.label}</div>
      <div className="now-stage">
        <span className="dot" style={{ background: stageColor(live.stageName) }} />
        {live.stageName || "TBA"}
        <span style={{ marginLeft: "auto", color: "var(--accent2)", fontWeight: 700 }}>
          {timeInZone(new Date(live.startMs).toISOString(), tz)}
        </span>
      </div>

      <div className="now-foot">
        {nn.next && leave != null ? (
          <div>
            <div className="now-next-label">{leave <= 0 ? "LEAVE" : "LEAVE IN"}</div>
            <div className="big-count">
              {leave <= 0 ? "now" : leave}
              {leave > 0 && <span style={{ fontSize: 24 }}>min</span>}
            </div>
          </div>
        ) : (
          <div>
            <div className="now-next-label">enjoy</div>
            <div className="now-next-name poster">Last set of your night</div>
          </div>
        )}
        {nn.next && (
          <div style={{ textAlign: "right" }}>
            <div className="now-next-label">next up</div>
            <div className="now-next-name poster">{nn.next.label}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {nn.next.stageName} · {timeInZone(new Date(nn.next.startMs).toISOString(), tz)}
            </div>
          </div>
        )}
      </div>

      <div className="now-progress">
        <div className="now-progress-fill" style={{ width: `${Math.round(nn.progress * 100)}%` }} />
      </div>

      {nn.next && nn.walkMinutes > 0 && (
        <button
          type="button"
          className="now-walk"
          onClick={() => navigate(`/route${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
        >
          <span className="ms" style={{ fontSize: 16, color: "var(--accent)" }}>directions_walk</span>
          {nn.walkMinutes} min walk to {nn.next.stageName}
          <span className="ms" style={{ fontSize: 15, marginLeft: "auto" }}>arrow_forward</span>
        </button>
      )}
    </section>
  );
}

function LaterList({
  rows,
  tz,
  photoByKey,
}: {
  rows: PlanSlot[];
  tz: string;
  photoByKey: Map<string, string | null>;
}): JSX.Element {
  return (
    <section className="glass list-card">
      <span className="label">Later tonight</span>
      {rows.map((slot) => (
        <div key={slot.setId} className="lineup-row">
          <span className="t">{timeInZone(new Date(slot.startMs).toISOString(), tz)}</span>
          <ArtistPhoto
            src={photoByKey.get(slot.actKey) ?? null}
            name={slot.label}
            width={PHOTO_WIDTH.avatar}
            className="row-photo"
          />
          <span className="dot" style={{ background: stageColor(slot.stageName) }} />
          <span className="n">{slot.label}</span>
          <span className="s">{slot.stageName}</span>
        </div>
      ))}
    </section>
  );
}

function performanceName(p: PerformanceDto): string {
  if (p.name && p.name.trim()) return p.name;
  if (p.artists.length > 0) return p.artists.map((a) => a.name).join(", ");
  return "TBA";
}

function shorten(name: string): string {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}
