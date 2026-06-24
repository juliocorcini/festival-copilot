/**
 * A2 "Now & Next" — minimal shell (fully built in P3 G3.3). Phase 1 goal: prove the
 * end-to-end data path by rendering the live lineup. Shows the current/next set as a
 * hero + the upcoming sets. Pre-festival, the hero is the festival's first set.
 */
import { useMemo } from "react";
import { AppHeader } from "../app/AppHeader";
import { ErrorState, EmptyState, LoadingState } from "../ui/states";
import { useLineup } from "../data/useLineup";
import { dayLabel, daysUntil, stageColor, timeInZone } from "../lib/format";
import type { PerformanceDto } from "../data/types";

const ms = (iso: string | null): number => (iso ? Date.parse(iso) : NaN);

export function NowScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();

  const model = useMemo(() => {
    if (!lineup) return null;
    const stageName = new Map(lineup.stages.map((s) => [s.id, s.name] as const));
    const timed = lineup.performances
      .filter((p) => p.startAtUtc && p.endAtUtc)
      .sort((a, b) => ms(a.startAtUtc) - ms(b.startAtUtc));
    const now = Date.now();
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
  }, [lineup]);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !model) {
    return (
      <>
        <AppHeader eyebrow="FestPilot" title="Now & Next" />
        <ErrorState message={error ?? "Could not load the lineup."} onRetry={reload} />
      </>
    );
  }

  const { hero } = model;
  const eyebrow = hero
    ? `${shorten(model.festivalName)} · ${dayLabel(hero.startAtUtc, model.tz)}`
    : shorten(model.festivalName);

  if (!hero) {
    return (
      <>
        <AppHeader eyebrow={eyebrow} title="Now & Next" />
        <EmptyState icon="calendar_month" title="Lineup coming soon" message="Sets will appear here as soon as the schedule is published." />
      </>
    );
  }

  const days = daysUntil(hero.startAtUtc);

  return (
    <>
      <AppHeader eyebrow={eyebrow} title="Now & Next" />
      <div className="screen">
        <section className="glass accent now-hero">
          <div className="blob" />
          <div className="now-tag" style={{ color: model.isLive ? "var(--ok-ink)" : "var(--accent2)" }}>
            {model.isLive ? <span className="live" /> : <span className="ms" style={{ fontSize: 14 }}>schedule</span>}
            {model.isLive ? "NOW" : "NEXT UP"}
          </div>
          <div className="now-title poster">{performanceName(hero)}</div>
          <div className="now-stage">
            <span className="dot" style={{ background: stageColor(model.stageName(hero.stageId)) }} />
            {model.stageName(hero.stageId) || "TBA"}
            <span style={{ marginLeft: "auto", color: "var(--accent2)", fontWeight: 700 }}>
              {timeInZone(hero.startAtUtc, model.tz)}
            </span>
          </div>

          {!model.isLive && days > 0 && (
            <div className="now-foot">
              <div>
                <div className="now-next-label">DOORS IN</div>
                <div className="poster" style={{ fontSize: 34, fontWeight: 800, lineHeight: 0.95, background: "linear-gradient(135deg,var(--accent),var(--accent2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {days}
                  <span style={{ fontSize: 18 }}>{days === 1 ? "day" : "days"}</span>
                </div>
              </div>
              {model.next && (
                <div style={{ textAlign: "right" }}>
                  <div className="now-next-label">then</div>
                  <div className="now-next-name poster">{performanceName(model.next)}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {model.stageName(model.next.stageId)} · {timeInZone(model.next.startAtUtc, model.tz)}
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
                {model.stageName(model.next.stageId)} · {timeInZone(model.next.startAtUtc, model.tz)}
              </div>
            </div>
          )}
        </section>

        {model.later.length > 0 && (
          <section className="glass list-card">
            <span className="label">Up next</span>
            {model.later.map((p) => (
              <div key={p.id} className="lineup-row">
                <span className="t">{timeInZone(p.startAtUtc, model.tz)}</span>
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

function performanceName(p: PerformanceDto): string {
  if (p.name && p.name.trim()) return p.name;
  if (p.artists.length > 0) return p.artists.map((a) => a.name).join(", ");
  return "TBA";
}

function shorten(name: string): string {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}
