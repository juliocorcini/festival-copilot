/**
 * Onboarding (#17): festival → weekend → days → swipe favorites. Selections persist locally
 * (DEC-041). Favoriting is by act/person (DEC-026/028) and an act shown once even across days.
 */
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PerformanceDto } from "../../data/types";
import { api } from "../../data/api";
import { useFavorites, useOnboarding } from "../../data/localStore";
import { useLineup } from "../../data/useLineup";
import { festivalDayIdByPerformanceId } from "../../domain/festivalDay";
import { uniqueActs, type Act } from "../../domain/lineup";
import { daysForWeekends, weekendDates, type DayInfo } from "../../lib/festival";
import { stageColor } from "../../lib/format";
import { ErrorState, LoadingState } from "../../ui/states";

const TOTAL_STEPS = 4;

export function OnboardingScreen(): JSX.Element {
  const { status, lineup, error, reload } = useLineup();
  const navigate = useNavigate();
  const onboarding = useOnboarding();
  const festivalId = lineup?.festival.id;
  const favorites = useFavorites(festivalId);

  const [step, setStep] = useState(1);
  const [weekendChoice, setWeekendChoice] = useState<string | "both" | null>(null);
  const [selectedDays, setSelectedDays] = useState<Set<string> | null>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);
  // Undo last swipe: remember the index we were at and whether THAT swipe newly favorited the act
  // (so undo only un-favorites picks this swipe created, never pre-existing favorites).
  const [swipeHistory, setSwipeHistory] = useState<{ index: number; favoritedActKey: string | null }[]>([]);

  const weekends = lineup?.weekends ?? [];
  const effectiveWeekend = weekendChoice ?? weekends[0]?.id ?? null;
  const weekendIds = useMemo(() => {
    if (!lineup) return [];
    if (effectiveWeekend === "both" || effectiveWeekend === null) return weekends.map((w) => w.id);
    return [effectiveWeekend];
  }, [lineup, effectiveWeekend, weekends]);

  const days = useMemo(() => (lineup ? daysForWeekends(lineup, weekendIds) : []), [lineup, weekendIds]);
  const activeDayKeys = selectedDays ?? new Set(days.map((d) => d.key));

  // Resolve each act's day through the derived festival-day blocks (DEC-048), so the day filter and
  // the day tag match the timetable instead of trusting the occasionally mis-tagged source label.
  const dayIdByPerf = useMemo(() => {
    if (!lineup) return new Map<string, string>();
    const scope = new Set(weekendIds);
    const scoped =
      weekendIds.length === 0
        ? lineup.performances
        : lineup.performances.filter((p) => !p.weekendId || scope.has(p.weekendId));
    return festivalDayIdByPerformanceId(scoped);
  }, [lineup, weekendIds]);
  const dayOf = useCallback((p: PerformanceDto): string | null => dayIdByPerf.get(p.id) ?? p.day, [dayIdByPerf]);

  const acts = useMemo(() => {
    if (!lineup) return [];
    const filtered = lineup.performances.filter((p) => {
      const inWeekend = weekendIds.length === 0 || !p.weekendId || weekendIds.includes(p.weekendId);
      const resolvedDay = dayOf(p);
      const inDay = !resolvedDay || activeDayKeys.has(resolvedDay);
      return inWeekend && inDay;
    });
    return uniqueActs(filtered, { dayOf });
  }, [lineup, weekendIds, activeDayKeys, dayOf]);

  if (status === "loading") return <div className="ob"><LoadingState /></div>;
  if (status === "error" || !lineup) {
    return <div className="ob">{<ErrorState message={error ?? "Could not load."} onRetry={reload} />}</div>;
  }

  const finish = (): void => {
    // Capture the full festival's act keys as the baseline for the R4.3 "lineup updated" prompt:
    // any acts added (or favorited acts later pulled) after this point will surface a revisit nudge.
    const seenActKeys = uniqueActs(lineup.performances).map((a) => a.actKey);
    onboarding.save({
      festivalId: lineup.festival.id,
      weekendIds,
      dayKeys: [...activeDayKeys],
      completed: true,
      seenActKeys,
    });
    navigate("/", { replace: true });
  };

  const next = (): void => setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  const back = (): void => setStep((s) => Math.max(s - 1, 1));

  const toggleDay = (key: string): void => {
    const base = selectedDays ?? new Set(days.map((d) => d.key));
    const nextSet = new Set(base);
    if (nextSet.has(key)) nextSet.delete(key);
    else nextSet.add(key);
    setSelectedDays(nextSet);
  };

  const currentAct = acts[swipeIndex];
  const swipe = (keep: boolean): void => {
    let favoritedActKey: string | null = null;
    if (keep && currentAct && !favorites.isFavorite(currentAct.actKey)) {
      favorites.toggle(currentAct.actKey);
      favoritedActKey = currentAct.actKey;
    }
    setSwipeHistory((h) => [...h, { index: swipeIndex, favoritedActKey }]);
    setSwipeIndex((i) => i + 1);
  };
  const undoSwipe = (): void => {
    if (swipeHistory.length === 0) return;
    const last = swipeHistory[swipeHistory.length - 1]!;
    if (last.favoritedActKey && favorites.isFavorite(last.favoritedActKey)) favorites.toggle(last.favoritedActKey);
    setSwipeIndex(last.index);
    setSwipeHistory((h) => h.slice(0, -1));
  };

  return (
    <div className="ob">
      <div className="ob-top">
        <button className="ob-back ms" onClick={back} style={{ visibility: step > 1 ? "visible" : "hidden" }}>
          arrow_back
        </button>
        <div className="ob-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <span key={i} className={`sd${i + 1 === step ? " on" : ""}`} />
          ))}
        </div>
        <button className="ob-skip" onClick={finish}>
          {step === TOTAL_STEPS ? "Done" : "Skip"}
        </button>
      </div>

      {step === 1 && <StepFestival name={lineup.festival.name} onNext={next} />}
      {step === 2 && (
        <StepWeekend
          weekends={weekends}
          choice={effectiveWeekend}
          onChoose={(id) => {
            setWeekendChoice(id);
            setSelectedDays(null);
          }}
          onNext={next}
        />
      )}
      {step === 3 && (
        <StepDays days={days} isSelected={(k) => activeDayKeys.has(k)} onToggle={toggleDay} onNext={next} />
      )}
      {step === 4 && (
        <StepSwipe
          act={currentAct}
          index={swipeIndex}
          total={acts.length}
          favoritesCount={favorites.count}
          stageName={currentAct ? stageNameFor(lineup, currentAct) : ""}
          dayTag={currentAct ? dayTag(currentAct, days) : ""}
          canUndo={swipeHistory.length > 0}
          onUndo={undoSwipe}
          onSwipe={swipe}
          onFinish={finish}
        />
      )}
    </div>
  );
}

function stageNameFor(lineup: ReturnType<typeof useLineup>["lineup"], act: Act): string {
  const id = act.stageIds[0];
  return lineup?.stages.find((s) => s.id === id)?.name ?? "";
}

function dayTag(act: Act, days: DayInfo[]): string {
  const labels = act.days.map((key) => days.find((d) => d.key === key)?.weekdayShort ?? key);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0]!;
  return `plays ${labels.join(" + ")}`;
}

function StepFestival({ name, onNext }: { name: string; onNext: () => void }): JSX.Element {
  const [suggesting, setSuggesting] = useState(false);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const submit = (): void => {
    const trimmed = value.trim();
    if (trimmed.length < 2 || state === "sending") return;
    setState("sending");
    api
      .suggestFestival(trimmed)
      .then(() => setState("sent"))
      .catch(() => setState("error"));
  };

  return (
    <>
      <div className="ob-body">
        <div className="ob-head">
          <div className="label">Step 1 of 4</div>
          <h1>Which festival are you going to?</h1>
        </div>
        <div className="ob-options">
          <button className="opt sel">
            <span className="opt-ico" style={{ background: "linear-gradient(135deg,var(--accent),var(--accent2))", color: "var(--bg)" }}>
              <span className="ms">festival</span>
            </span>
            <span className="opt-main">
              <span className="opt-title">{name}</span>
              <span className="opt-sub">Boom, Belgium · Jul 2026</span>
            </span>
            <span className="ms check">check_circle</span>
          </button>

          {!suggesting ? (
            <button className="opt" onClick={() => setSuggesting(true)}>
              <span className="opt-ico" style={{ background: "rgba(255,255,255,.05)" }}>
                <span className="ms" style={{ color: "var(--muted)" }}>add</span>
              </span>
              <span className="opt-main">
                <span className="opt-title" style={{ fontSize: 15 }}>Suggest a festival</span>
                <span className="opt-sub">Tell us which one to add next</span>
              </span>
            </button>
          ) : state === "sent" ? (
            <div className="ob-suggest-done">
              <span className="ms">check_circle</span>
              <span>Thanks! We'll look into <b>{value.trim()}</b>.</span>
            </div>
          ) : (
            <div className="ob-suggest">
              <input
                className="ob-suggest-input"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  if (state === "error") setState("idle");
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="Festival name…"
                aria-label="Festival name"
                maxLength={80}
                autoFocus
              />
              <button
                className="ob-suggest-send"
                type="button"
                disabled={value.trim().length < 2 || state === "sending"}
                onClick={submit}
              >
                {state === "sending" ? "Sending…" : "Send"}
              </button>
              {state === "error" && <div className="ob-suggest-err">Couldn't send — try again.</div>}
            </div>
          )}
        </div>
      </div>
      <div className="ob-foot">
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </>
  );
}

function StepWeekend({
  weekends,
  choice,
  onChoose,
  onNext,
}: {
  weekends: { id: string; name: string; startDate: string | null; endDate: string | null }[];
  choice: string | "both" | null;
  onChoose: (id: string | "both") => void;
  onNext: () => void;
}): JSX.Element {
  return (
    <>
      <div className="ob-body">
        <div className="ob-head">
          <div className="label">Step 2 of 4</div>
          <h1>Which weekend?</h1>
          <p>Tomorrowland runs two weekends with <b>different lineups</b>. Pick yours so we only show artists you can actually see.</p>
        </div>
        <div className="ob-options">
          {weekends.map((w) => (
            <button key={w.id} className={`opt${choice === w.id ? " sel" : ""}`} onClick={() => onChoose(w.id)}>
              <span className="opt-main">
                <span className="opt-title">{w.name}</span>
                <span className="opt-sub">{weekendDates(w) || "Dates TBA"}</span>
              </span>
              <span className="ms check">check_circle</span>
            </button>
          ))}
          {weekends.length > 1 && (
            <button className={`opt${choice === "both" ? " sel" : ""}`} onClick={() => onChoose("both")}>
              <span className="opt-main">
                <span className="opt-title">Both weekends</span>
                <span className="opt-sub">The full Tomorrowland</span>
              </span>
              <span className="ms check">check_circle</span>
            </button>
          )}
        </div>
      </div>
      <div className="ob-foot">
        <button className="btn btn-primary" onClick={onNext}>Continue</button>
      </div>
    </>
  );
}

function StepDays({
  days,
  isSelected,
  onToggle,
  onNext,
}: {
  days: DayInfo[];
  isSelected: (key: string) => boolean;
  onToggle: (key: string) => void;
  onNext: () => void;
}): JSX.Element {
  return (
    <>
      <div className="ob-body">
        <div className="ob-head">
          <div className="label">Step 3 of 4</div>
          <h1>Which days?</h1>
          <p>Pick all the days you'll be there.</p>
        </div>
        <div className="ob-options">
          {days.map((d) => (
            <button key={d.key} className={`opt${isSelected(d.key) ? " sel" : ""}`} onClick={() => onToggle(d.key)}>
              <span className="opt-main">
                <span className="opt-title">{d.weekdayLong}</span>
                <span className="opt-sub">{d.dateLabel}</span>
              </span>
              <span className="ms check">check_circle</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ob-foot">
        <button className="btn btn-primary" onClick={onNext}>Start picking artists</button>
      </div>
    </>
  );
}

function StepSwipe({
  act,
  index,
  total,
  favoritesCount,
  stageName,
  dayTag: dayTagText,
  canUndo,
  onUndo,
  onSwipe,
  onFinish,
}: {
  act: Act | undefined;
  index: number;
  total: number;
  favoritesCount: number;
  stageName: string;
  dayTag: string;
  canUndo: boolean;
  onUndo: () => void;
  onSwipe: (keep: boolean) => void;
  onFinish: () => void;
}): JSX.Element {
  const progress = total > 0 ? Math.min(100, Math.round(((index) / total) * 100)) : 100;

  if (!act) {
    return (
      <>
        <div className="ob-body" style={{ justifyContent: "center" }}>
          <div className="state">
            <span className="ms">celebration</span>
            <h2>That's everyone!</h2>
            <p>{favoritesCount} favorite{favoritesCount === 1 ? "" : "s"} saved. You can always add more from the Lineup.</p>
            {canUndo && (
              <button className="swipe-undo" onClick={onUndo}>
                <span className="ms" style={{ fontSize: 16 }}>undo</span> Back to last artist
              </button>
            )}
          </div>
        </div>
        <div className="ob-foot">
          <button className="btn btn-primary" onClick={onFinish}>See my plan</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="ob-body">
        <div className="swipe-head">
          <div className="count">{Math.min(index + 1, total)} of {total}</div>
          <div className="swipe-bar"><div style={{ width: `${progress}%` }} /></div>
          <button
            className="swipe-undo sm"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo last swipe"
          >
            <span className="ms" style={{ fontSize: 15 }}>undo</span> Undo
          </button>
        </div>
        <div className="swipe-q">
          <div className="q">Would you see this set?</div>
          <div className="hint">Builds your favorites — clashes are solved later in Lock in</div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <div className="art-card">
            <div className="art-glow" />
            <div className="art-inner">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="art-stage">
                  <span className="dot" style={{ background: stageColor(stageName) }} /> {stageName.toUpperCase()}
                </span>
                {dayTagText && <span className="art-day">{dayTagText}</span>}
              </div>
              <div>
                <div className="art-name">{act.label}</div>
                {act.days.length > 1 && (
                  <div className="art-note">Shown once even though they play {act.days.length} days.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="swipe-actions">
        <button className="nah" onClick={() => onSwipe(false)}>Nah</button>
        <button className="yes" onClick={() => onSwipe(true)}>I'd see this!</button>
      </div>
    </>
  );
}
