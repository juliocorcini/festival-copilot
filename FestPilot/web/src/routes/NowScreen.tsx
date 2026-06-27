/**
 * A2 "Now & Next" home (#18, UC-12/DEC-022, R6). The hero is NEVER an arbitrary lineup act — it is
 * sourced, in strict priority:
 *   1. the day's locked plan (rich hero: what's on NOW + a live LEAVE IN to the next set + walk),
 *   2. else the user's own favorites in chronological order (now / next / later),
 *   3. else an honest empty state (pick artists · set times not out · nothing coming up).
 * The chronology + leave-in math are pure (`domain/nowNext.ts`); this screen only renders the model.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { PullToRefresh } from "../ui/PullToRefresh";
import { useLineup } from "../data/useLineup";
import { useFavorites, useOnboarding, usePlan } from "../data/localStore";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { buildNowNext, chronoNowNext, type HomeSet } from "../domain/nowNext";
import { actKey, actLabel, imageByActKey } from "../domain/lineup";
import { daysForWeekends } from "../lib/festival";
import { dayLabel, daysUntil, stageColor, timeInZone } from "../lib/format";
import { useT, useLocale } from "../i18n";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import { useArtistSheet, openOnActivate } from "../ui/useArtistSheet";
import { SquadNowCard } from "./squad/SquadNowCard";

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
  const t = useT();
  const locale = useLocale();
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
  const days = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds, locale) : []), [lineup, weekendIds, locale]);
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
        stageName: (p.stageId ? stageNameById.get(p.stageId) : "") || t("common.tba"),
        startMs: ms(p.startAtUtc),
        endMs: ms(p.endAtUtc),
        imageUrl: p.artists[0]?.imageUrl ?? null,
      }));
  }, [lineup, favorites.keys, stageNameById, t]);
  const favChrono = useMemo(() => chronoNowNext(favSets, now), [favSets, now]);

  if (status === "loading") return <LoadingState />;
  if (status === "error" || !lineup) {
    return (
      <>
        <AppHeader eyebrow="FestPilot" title={t("now.title")} />
        <ErrorState message={error ?? t("now.loadError")} onRetry={reload} />
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
        <AppHeader eyebrow={shorten(festivalName)} title={t("now.title")} />
        <PullToRefresh onRefresh={reload} />
        <div className="screen">
          <SquadNowCard />
          <NowEmpty
            favCount={favorites.count}
            hasTimetable={lineup.hasTimetable}
            onBrowse={() => navigate("/lineup")}
          />
        </div>
      </>
    );
  }

  const eyebrow = `${shorten(festivalName)} · ${dayLabel(new Date(vm.hero.startMs).toISOString(), tz, locale)}`;
  const dayKey = activeDay?.key ?? null;
  const laterLabel = vm.source === "plan" ? t("now.laterTonight") : t("now.upNext");
  const srcLine =
    vm.source === "plan"
      ? t("now.srcPlan", { count: planSlots.length, sets: planSlots.length === 1 ? t("common.set") : t("common.sets") })
      : t("now.srcFavorites", { count: favSets.length });

  return (
    <>
      <AppHeader eyebrow={eyebrow} title={t("now.title")} />
      <PullToRefresh onRefresh={reload} />
      <div className="screen">
        <NowHero
          vm={vm}
          tz={tz}
          now={now}
          onRoute={() => navigate(`/route${dayKey ? `?day=${encodeURIComponent(dayKey)}` : ""}`)}
        />
        <SquadNowCard />
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
  const t = useT();
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
        {isLive ? t("now.now") : t("now.nextUp")}
      </div>
      <div
        className="now-title poster tappable"
        role="button"
        tabIndex={0}
        aria-label={t("common.viewAct", { name: hero.label })}
        onClick={() => openArtist(hero.actKey)}
        onKeyDown={openOnActivate(() => openArtist(hero.actKey))}
      >
        {hero.label}
      </div>
      <div className="now-stage">
        <span className="dot" style={{ background: stageColor(hero.stageName) }} />
        {hero.stageName || t("common.tba")}
        <span style={{ marginLeft: "auto", color: "var(--accent2)", fontWeight: 700 }}>
          {timeInZone(heroIso, tz)}
        </span>
      </div>

      <div className="now-foot">
        {isLive ? (
          vm.source === "plan" && vm.leaveInMinutes != null && next ? (
            <div>
              <div className="now-next-label">{vm.leaveInMinutes <= 0 ? t("now.leave") : t("now.leaveIn")}</div>
              <div className="big-count">
                <span key={vm.leaveInMinutes} className="count-pop">
                  {vm.leaveInMinutes <= 0 ? t("now.nowLower") : vm.leaveInMinutes}
                </span>
                {vm.leaveInMinutes > 0 && <span style={{ fontSize: 24 }}>{t("now.min")}</span>}
              </div>
            </div>
          ) : (
            <div>
              <div className="now-next-label">{next ? t("now.onNow") : t("now.enjoy")}</div>
              <div className="now-next-name poster">{next ? t("now.liveRightNow") : t("now.lastOnList")}</div>
            </div>
          )
        ) : (
          <div>
            <div className="now-next-label">{daysAhead > 0 ? t("now.doorsIn") : t("now.startsIn")}</div>
            <div className="big-count">
              <span key={daysAhead > 0 ? `d${daysAhead}` : `m${startsInMin}`} className="count-pop">
                {daysAhead > 0 ? daysAhead : startsInMin}
              </span>
              <span style={{ fontSize: daysAhead > 0 ? 18 : 24 }}>
                {daysAhead > 0 ? (daysAhead === 1 ? t("now.day") : t("now.days")) : t("now.min")}
              </span>
            </div>
          </div>
        )}
        {next && (
          <div style={{ textAlign: "right" }}>
            <div className="now-next-label">{isLive && vm.leaveInMinutes != null ? t("now.nextUpLower") : t("now.then")}</div>
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
          {t("now.walkTo", { min: vm.walkMinutes, stage: next.stageName })}
          <span className="ms" style={{ fontSize: 15, marginLeft: "auto" }}>arrow_forward</span>
        </button>
      )}
    </section>
  );
}

function NowList({ rows, tz, label }: { rows: HomeSet[]; tz: string; label: string }): JSX.Element {
  const { openArtist } = useArtistSheet();
  const t = useT();
  return (
    <section className="glass list-card">
      <span className="label">{label}</span>
      {rows.map((r, i) => (
        <div
          key={`${r.actKey}-${r.startMs}`}
          className="lineup-row tappable fp-rise"
          style={{ "--i": i } as CSSProperties}
          role="button"
          tabIndex={0}
          aria-label={t("common.viewAct", { name: r.label })}
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
  const t = useT();
  if (favCount === 0) {
    return (
      <EmptyState
        icon="favorite"
        title={t("now.emptyPickTitle")}
        message={t("now.emptyPickMsg")}
        action={{ label: t("now.emptyPickCta"), icon: "queue_music", onClick: onBrowse }}
      />
    );
  }
  if (!hasTimetable) {
    return (
      <EmptyState
        icon="schedule"
        title={t("now.emptyTimesTitle")}
        message={favCount === 1 ? t("now.emptyTimesMsgOne", { count: favCount }) : t("now.emptyTimesMsgMany", { count: favCount })}
        action={{ label: t("now.emptyTimesCta"), icon: "favorite", onClick: onBrowse }}
      />
    );
  }
  return (
    <EmptyState
      icon="event_available"
      title={t("now.emptyNothingTitle")}
      message={t("now.emptyNothingMsg")}
      action={{ label: t("now.emptyNothingCta"), icon: "queue_music", onClick: onBrowse }}
    />
  );
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function shorten(name: string): string {
  return name.length > 22 ? `${name.slice(0, 21)}…` : name;
}
