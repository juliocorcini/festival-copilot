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
import { FitText } from "../app/FitText";
import { EmptyState, ErrorState, LoadingState } from "../ui/states";
import { PullToRefresh } from "../ui/PullToRefresh";
import { useLineup } from "../data/useLineup";
import { loadStore, planKey, useFavorites, useOnboarding, usePlan } from "../data/localStore";
import { useTravelMatrix } from "../data/useTravelMatrix";
import { buildNowNext, chronoNowNext, type HomeSet } from "../domain/nowNext";
import { actKey, actLabel, imageByActKey } from "../domain/lineup";
import { daysForWeekends, pickActiveDay } from "../lib/festival";
import { dayLabel, daysUntil, stageColor, timeInZone } from "../lib/format";
import { useT, useLocale } from "../i18n";
import { ArtistPhoto } from "../ui/ArtistPhoto";
import { PHOTO_WIDTH } from "../lib/photo";
import { useArtistSheet, openOnActivate } from "../ui/useArtistSheet";
import { useIdentity } from "../data/identity";
import { useMyGroups } from "../data/groups";
import { useGroupPresence } from "../data/presence";
import { useGroupEvents } from "../data/groupEvents";
import { useMeetingPoints } from "../data/meetingPoints";
import { useSquadNextUp } from "../data/squadPlan";
import type { GroupDto } from "../data/types";
import { SafetyBannerLive, SquadNextUpCard, WhereEveryoneCard, SquadAgendaCard } from "./squad/squadHomeCards";

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

/**
 * Now & Next home. The personal hero is the default; for a squad user it gains a "My plan / Squad"
 * toggle (D24 · DEC-086) that flips the hero between their plan and the squad's next-up — gated so a
 * solo user makes ZERO squad network calls (identity → groups, both before any squad fetch).
 */
export function NowScreen(): JSX.Element {
  const { hasProfile } = useIdentity();
  // Solo / signed-out: render the personal home with no squad tab and no squad network.
  if (!hasProfile) return <NowScreenBody />;
  return <NowSquadAware />;
}

/** Signed-in: detect a squad (once), then offer the My-plan / Squad toggle without flashing. */
function NowSquadAware(): JSX.Element {
  const { groups, status } = useMyGroups();
  const [mode, setMode] = useState<NowMode>("my");
  if (status !== "ready" || groups.length === 0) return <NowScreenBody />;
  // A "needs help" must never be buried in the Squad tab — surface the SOS banner on the Now home
  // (both tabs) for the squad the user last looked at (E12/DEC-100).
  const bannerGroup = groups.find((g) => g.id === readActiveGroup()) ?? groups[0]!;
  const tabs = (
    <>
      <SafetyBannerLive groupId={bannerGroup.id} />
      <NowTabs mode={mode} onMode={setMode} />
    </>
  );
  return mode === "my" ? <NowScreenBody topSlot={tabs} /> : <NowSquadScreen groups={groups} topSlot={tabs} />;
}

type NowMode = "my" | "squad";

function NowScreenBody({ topSlot }: { topSlot?: JSX.Element }): JSX.Element {
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
  const activeDay = useMemo(() => pickActiveDay(days, now), [days, now]);

  // F13/DEC-113: if the active day has no plan, fall forward to the next day that does.
  const effectivePlanDay = useMemo(() => {
    if (!lineup?.festival.id || days.length === 0) return activeDay;
    const store = loadStore();
    const fid = lineup.festival.id;
    const activeDayKey = activeDay?.key;
    if (activeDayKey && store.plans[planKey(fid, activeDayKey)]?.slots?.length) return activeDay;
    const activeIdx = activeDay ? days.indexOf(activeDay) : 0;
    for (let i = Math.max(0, activeIdx); i < days.length; i++) {
      if (store.plans[planKey(fid, days[i]!.key)]?.slots?.length) return days[i]!;
    }
    return activeDay;
  }, [lineup?.festival.id, days, activeDay]);

  const plan = usePlan(lineup?.festival.id, effectivePlanDay?.key);

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
        <AppHeader eyebrow={<FitText text={festivalName} />} title={t("now.title")} />
        <PullToRefresh onRefresh={reload} />
        <div className="screen">
          {topSlot}
          <NowEmpty
            favCount={favorites.count}
            hasTimetable={lineup.hasTimetable}
            onBrowse={() => navigate("/lineup")}
          />
        </div>
      </>
    );
  }

  const eyebrowText = `${festivalName} · ${dayLabel(new Date(vm.hero.startMs).toISOString(), tz, locale)}`;
  const dayKey = activeDay?.key ?? null;
  const laterLabel = vm.source === "plan" ? t("now.laterTonight") : t("now.upNext");
  const srcLine =
    vm.source === "plan"
      ? t("now.srcPlan", { count: planSlots.length, sets: planSlots.length === 1 ? t("common.set") : t("common.sets") })
      : t("now.srcFavorites", { count: favSets.length });

  return (
    <>
      <AppHeader eyebrow={<FitText text={eyebrowText} />} title={t("now.title")} />
      <PullToRefresh onRefresh={reload} />
      <div className="screen">
        {topSlot}
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

/** The "My plan / Squad" segmented toggle that sits atop the Home for a squad user (D24). */
function NowTabs({ mode, onMode }: { mode: NowMode; onMode: (m: NowMode) => void }): JSX.Element {
  const t = useT();
  return (
    <div className="seg now-tabs" role="tablist" aria-label={t("now.title")}>
      <button role="tab" aria-selected={mode === "my"} className={mode === "my" ? "on" : ""} onClick={() => onMode("my")}>
        {t("now.tabMyPlan")}
      </button>
      <button role="tab" aria-selected={mode === "squad"} className={mode === "squad" ? "on" : ""} onClick={() => onMode("squad")}>
        {t("now.tabSquad")}
      </button>
    </div>
  );
}

/** Same key SquadScreen uses, so the Home Squad tab mirrors the squad the user last looked at. */
const ACTIVE_GROUP_KEY = "fp.activeGroup.v1";
function readActiveGroup(): string | null {
  try {
    return localStorage.getItem(ACTIVE_GROUP_KEY);
  } catch {
    return null;
  }
}

/** The "Squad" tab of the Home — the squad's Next up + a shortcut into the full plan (D24 · DEC-086). */
function NowSquadScreen({ groups, topSlot }: { groups: GroupDto[]; topSlot: JSX.Element }): JSX.Element {
  const [activeId, setActiveId] = useState<string | null>(readActiveGroup);
  const group = groups.find((g) => g.id === activeId) ?? groups[0]!;
  const select = (id: string): void => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_GROUP_KEY, id);
    } catch {
      /* private mode — in-memory only */
    }
  };
  return <NowSquadInner key={group.id} group={group} groups={groups} onSelect={select} topSlot={topSlot} />;
}

function NowSquadInner({
  group,
  groups,
  onSelect,
  topSlot,
}: {
  group: GroupDto;
  groups: GroupDto[];
  onSelect: (id: string) => void;
  topSlot: JSX.Element;
}): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const { presence } = useGroupPresence(group.id);
  const { events } = useGroupEvents(group.id);
  const { points } = useMeetingPoints(group.id);
  const { sets: nextUpSets, hasPlan } = useSquadNextUp(group.id);

  return (
    <>
      <AppHeader eyebrow={`${group.emoji ? `${group.emoji} ` : ""}${group.name}`} title={t("now.title")} />
      <div className="screen">
        {topSlot}
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
          </div>
        )}
        <SquadNextUpCard
          groupId={group.id}
          events={events}
          points={points}
          presence={presence}
          sets={nextUpSets}
          onOpen={() => navigate("/squad")}
        />
        <WhereEveryoneCard groupId={group.id} presence={presence} />
        {events.length > 0 && <SquadAgendaCard groupId={group.id} events={events} />}
        <button className="glass squad-plan-cta" onClick={() => navigate(`/squad/${group.id}/plan`)}>
          <div className="squad-plan-icon">
            <span className="ms">event_available</span>
          </div>
          <div className="squad-plan-main">
            <div className="squad-plan-title">{hasPlan ? t("squad.viewPlan") : t("squad.buildPlan")}</div>
            <div className="squad-plan-sub">{hasPlan ? t("squad.viewPlanSub") : t("squad.buildPlanSub")}</div>
          </div>
          <span className="ms" style={{ color: "var(--accent)" }}>chevron_right</span>
        </button>
      </div>
    </>
  );
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
