/**
 * A2 "Now & Next" home (#18, UC-12/DEC-022, R6). The hero is NEVER an arbitrary lineup act — it is
 * sourced, in strict priority:
 *   1. the day's locked plan (rich hero: what's on NOW + a live LEAVE IN to the next set + walk),
 *   2. else the user's own favorites in chronological order (now / next / later),
 *   3. else an honest empty state (pick artists · set times not out · nothing coming up).
 * The chronology + leave-in math are pure (`domain/nowNext.ts`); this screen only renders the model.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { useLineup } from "../data/useLineup";
import { useFavorites, useOnboarding, usePlan } from "../data/localStore";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { buildNowNext, chronoNowNext, type HomeSet } from "../domain/nowNext";
import { actKey, actLabel, imageByActKey } from "../domain/lineup";
import { daysForWeekends } from "../lib/festival";
import { dayLabel, daysUntil, stageColor, timeInZone } from "../lib/format";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import { useArtistSheet, openOnActivate } from "../ui/useArtistSheet";

const ms = (iso: string | null): number => (iso ? Date.parse(iso) : NaN);

type HeroSource = "plan" | "favorites";

interface HeroVM {
  source: HeroSource;
  isLive: boolean;
  hero: HomeSet;
  next: HomeSet | null;
  later: HomeSet[];
  /** Elapsed fraction of the live set [0..1]; 0 when nothing is live. */
  progress: number;
  /** Plan-only, live-only: minutes until you must leave for `next` (start − walk − now). */
  leaveInMinutes: number | null;
  /** Plan-only, live-only: whole-minute walk to `next`'s stage. */
  walkMinutes: number;
}

export function NowScreen(): JSX.Element {
  const navigate = useNavigate();
  const { status, lineup, error, reload } = useLineup();
  const { onboarding } = useOnboarding();
  const favorites = useFavorites(lineup?.festival.id);
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

  const photoByKey = useMemo(() => imageByActKey(lineup?.performances ?? []), [lineup]);
  const stageNameById = useMemo(
    () => new Map((lineup?.stages ?? []).map((s) => [s.id, s.name] as const)),
    [lineup]
  );

  // Source 1 — the day's locked plan. `buildNowNext` carries the real walk + leave-in; we reuse the
  // same slots as HomeSets so the hero renders through one consistent path.
  const planSlots = plan.plan?.slots ?? [];
  const planNN = useMemo(
    () => (planSlots.length > 0 ? buildNowNext(planSlots, travel, now) : null),
    [planSlots, travel, now]
  );
  const planSets = useMemo<HomeSet[]>(
    () =>
      planSlots.map((s) => ({
        id: s.setId,
        actKey: s.actKey,
        label: s.label,
        stageName: s.stageName,
        startMs: s.startMs,
        endMs: s.cutMs != null && s.cutMs > s.startMs && s.cutMs < s.endMs ? s.cutMs : s.endMs,
        imageUrl: photoByKey.get(s.actKey) ?? null,
      })),
    [planSlots, photoByKey]
  );
  const planChrono = useMemo(() => chronoNowNext(planSets, now), [planSets, now]);

  // Source 2 — the user's favorites, festival-wide, in chronological order. Only ones with set times.
  const favSets = useMemo<HomeSet[]>(() => {
    if (!lineup) return [];
    return lineup.performances
      .filter((p) => p.startAtUtc && p.endAtUtc && favorites.keys.has(actKey(p)))
      .map((p) => ({
        id: p.id,
        actKey: actKey(p),
        label: actLabel(p),
        stageName: (p.stageId ? stageNameById.get(p.stageId) : "") || "TBA",
        startMs: ms(p.startAtUtc),
        endMs: ms(p.endAtUtc),
        imageUrl: p.artists[0]?.imageUrl ?? null,
      }));
  }, [lineup, favorites.keys, stageNameById]);
  const favChrono = useMemo(() => chronoNowNext(favSets, now), [favSets, now]);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup) {
    return (
      <>
        <AppHeader eyebrow="FestPilot" title="Now & Next" />
        <ErrorState message={error ?? "Could not load the lineup."} onRetry={reload} />
      </>
    );
  }

  const festivalName = lineup.festival.name;
  const tz = lineup.festival.timezone;

  const source: HeroSource | null = planChrono.hero ? "plan" : favChrono.hero ? "favorites" : null;
  const chrono = source === "plan" ? planChrono : source === "favorites" ? favChrono : null;
  let vm: HeroVM | null = null;
  if (source && chrono?.hero) {
    const isLive = chrono.live != null;
    const livePlan = source === "plan" && isLive;
    vm = {
      source,
      isLive,
      hero: chrono.hero,
      next: chrono.next,
      later: chrono.later,
      progress: isLive ? clamp01((now - chrono.hero.startMs) / Math.max(1, chrono.hero.endMs - chrono.hero.startMs)) : 0,
      leaveInMinutes: livePlan ? planNN?.leaveInMinutes ?? null : null,
      walkMinutes: livePlan ? planNN?.walkMinutes ?? 0 : 0,
    };
  }

  if (!vm) {
    return (
      <>
        <AppHeader eyebrow={shorten(festivalName)} title="Now & Next" />
        <NowEmpty
          favCount={favorites.count}
          hasTimetable={lineup.hasTimetable}
          onBrowse={() => navigate("/lineup")}
        />
      </>
    );
  }

  const eyebrow = `${shorten(festivalName)} · ${dayLabel(new Date(vm.hero.startMs).toISOString(), tz)}`;
  const dayKey = activeDay?.key ?? null;
  const laterLabel = vm.source === "plan" ? "Later tonight" : "Up next";
  const srcLine =
    vm.source === "plan"
      ? `From your locked plan · ${planSlots.length} set${planSlots.length === 1 ? "" : "s"}`
      : `From your favorites · ${favSets.length} with set times`;

  return (
    <>
      <AppHeader eyebrow={eyebrow} title="Now & Next" />
      <div className="screen">
        <NowHero
          vm={vm}
          tz={tz}
          now={now}
          onRoute={() => navigate(`/route${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
        />
        {vm.later.length > 0 && <NowList rows={vm.later} tz={tz} label={laterLabel} />}
        <p className="src" style={{ textAlign: "center" }}>{srcLine}</p>
      </div>
    </>
  );
}

function NowHero({
  vm,
  tz,
  now,
  onRoute,
}: {
  vm: HeroVM;
  tz: string;
  now: number;
  onRoute: () => void;
}): JSX.Element {
  const { openArtist } = useArtistSheet();
  const { hero, next, isLive } = vm;
  const heroIso = new Date(hero.startMs).toISOString();
  const daysAhead = daysUntil(heroIso);
  const startsInMin = Math.max(0, Math.round((hero.startMs - now) / 60_000));

  return (
    <section className="glass accent now-hero">
      <div className="blob" />
      <ArtistPhoto src={hero.imageUrl} name={hero.label} width={PHOTO_WIDTH.card} className="now-hero-photo" />
      <div className="now-tag" style={{ color: isLive ? "var(--ok-ink)" : "var(--accent2)" }}>
        {isLive ? <span className="live" /> : <span className="ms" style={{ fontSize: 14 }}>schedule</span>}
        {isLive ? "NOW" : "NEXT UP"}
      </div>
      <div
        className="now-title poster tappable"
        role="button"
        tabIndex={0}
        aria-label={`View ${hero.label}`}
        onClick={() => openArtist(hero.actKey)}
        onKeyDown={openOnActivate(() => openArtist(hero.actKey))}
      >
        {hero.label}
      </div>
      <div className="now-stage">
        <span className="dot" style={{ background: stageColor(hero.stageName) }} />
        {hero.stageName || "TBA"}
        <span style={{ marginLeft: "auto", color: "var(--accent2)", fontWeight: 700 }}>
          {timeInZone(heroIso, tz)}
        </span>
      </div>

      <div className="now-foot">
        {isLive ? (
          vm.source === "plan" && vm.leaveInMinutes != null && next ? (
            <div>
              <div className="now-next-label">{vm.leaveInMinutes <= 0 ? "LEAVE" : "LEAVE IN"}</div>
              <div className="big-count">
                {vm.leaveInMinutes <= 0 ? "now" : vm.leaveInMinutes}
                {vm.leaveInMinutes > 0 && <span style={{ fontSize: 24 }}>min</span>}
              </div>
            </div>
          ) : (
            <div>
              <div className="now-next-label">{next ? "on now" : "enjoy"}</div>
              <div className="now-next-name poster">{next ? "Live right now" : "Last on your list"}</div>
            </div>
          )
        ) : (
          <div>
            <div className="now-next-label">{daysAhead > 0 ? "DOORS IN" : "STARTS IN"}</div>
            <div className="big-count">
              {daysAhead > 0 ? daysAhead : startsInMin}
              <span style={{ fontSize: daysAhead > 0 ? 18 : 24 }}>
                {daysAhead > 0 ? (daysAhead === 1 ? "day" : "days") : "min"}
              </span>
            </div>
          </div>
        )}
        {next && (
          <div style={{ textAlign: "right" }}>
            <div className="now-next-label">{isLive && vm.leaveInMinutes != null ? "next up" : "then"}</div>
            <div className="now-next-name poster">{next.label}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
              {next.stageName} · {timeInZone(new Date(next.startMs).toISOString(), tz)}
            </div>
          </div>
        )}
      </div>

      {isLive && (
        <div className="now-progress">
          <div className="now-progress-fill" style={{ width: `${Math.round(vm.progress * 100)}%` }} />
        </div>
      )}

      {isLive && vm.source === "plan" && next && vm.walkMinutes > 0 && (
        <button type="button" className="now-walk" onClick={onRoute}>
          <span className="ms" style={{ fontSize: 16, color: "var(--accent)" }}>directions_walk</span>
          {vm.walkMinutes} min walk to {next.stageName}
          <span className="ms" style={{ fontSize: 15, marginLeft: "auto" }}>arrow_forward</span>
        </button>
      )}
    </section>
  );
}

function NowList({ rows, tz, label }: { rows: HomeSet[]; tz: string; label: string }): JSX.Element {
  const { openArtist } = useArtistSheet();
  return (
    <section className="glass list-card">
      <span className="label">{label}</span>
      {rows.map((r) => (
        <div
          key={`${r.actKey}-${r.startMs}`}
          className="lineup-row tappable"
          role="button"
          tabIndex={0}
          aria-label={`View ${r.label}`}
          onClick={() => openArtist(r.actKey)}
          onKeyDown={openOnActivate(() => openArtist(r.actKey))}
        >
          <span className="t">{timeInZone(new Date(r.startMs).toISOString(), tz)}</span>
          <ArtistPhoto src={r.imageUrl} name={r.label} width={PHOTO_WIDTH.avatar} className="row-photo" />
          <span className="dot" style={{ background: stageColor(r.stageName) }} />
          <span className="n">{r.label}</span>
          <span className="s">{r.stageName}</span>
        </div>
      ))}
    </section>
  );
}

function NowEmpty({
  favCount,
  hasTimetable,
  onBrowse,
}: {
  favCount: number;
  hasTimetable: boolean;
  onBrowse: () => void;
}): JSX.Element {
  if (favCount === 0) {
    return (
      <EmptyState
        icon="favorite"
        title="Pick the acts you can't miss"
        message="Favorite artists and FestPilot lines up what's on now and next — and when to leave to make it."
        action={{ label: "Browse the lineup", icon: "queue_music", onClick: onBrowse }}
      />
    );
  }
  if (!hasTimetable) {
    return (
      <EmptyState
        icon="schedule"
        title="Set times aren't out yet"
        message={`Your ${favCount} favorite${favCount === 1 ? "" : "s"} will appear here the moment the schedule drops.`}
        action={{ label: "Review your favorites", icon: "favorite", onClick: onBrowse }}
      />
    );
  }
  return (
    <EmptyState
      icon="event_available"
      title="Nothing coming up"
      message="You've seen all your picks for now — browse the lineup to add a few more."
      action={{ label: "Open the lineup", icon: "queue_music", onClick: onBrowse }}
    />
  );
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function shorten(name: string): string {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}
