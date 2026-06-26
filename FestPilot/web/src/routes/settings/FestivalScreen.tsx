/**
 * Festival & weekend settings (DEC-048). Onboarding picks the weekend(s) and days once; this screen
 * lets the user change that choice afterwards. Changing the weekend re-scopes every weekend-aware
 * surface (Lineup, favorites view, My Plan) — exactly like the timetable — and resets the day picker
 * to the new weekend's days. Applies on tap (no Save button), mirroring the Appearance screen.
 */
import { useMemo, useState } from "react";
import { StackHeader } from "../../app/StackHeader";
import { useLineup } from "../../data/useLineup";
import { useOnboarding } from "../../data/localStore";
import { daysForWeekends, weekendDates, type DayInfo } from "../../lib/festival";
import { useT } from "../../i18n";
import { ErrorState, LoadingState } from "../../ui/states";

type WeekendChoice = string | "both";

export function FestivalScreen(): JSX.Element {
  const t = useT();
  const { status, lineup, error, reload } = useLineup();
  const { onboarding, save } = useOnboarding();

  const weekends = lineup?.weekends ?? [];
  const storedWeekendIds = onboarding?.weekendIds ?? [];
  const [choice, setChoice] = useState<WeekendChoice>(
    storedWeekendIds.length === 1 ? storedWeekendIds[0]! : "both"
  );
  const [selectedDays, setSelectedDays] = useState<Set<string> | null>(
    onboarding?.dayKeys && onboarding.dayKeys.length > 0 ? new Set(onboarding.dayKeys) : null
  );
  const [justSaved, setJustSaved] = useState(false);

  const weekendIds = useMemo(() => {
    if (!lineup) return [];
    return choice === "both" ? weekends.map((w) => w.id) : [choice];
  }, [lineup, choice, weekends]);

  const days = useMemo<DayInfo[]>(
    () => (lineup ? daysForWeekends(lineup, weekendIds) : []),
    [lineup, weekendIds]
  );
  const activeDayKeys = selectedDays ?? new Set(days.map((d) => d.key));

  if (status === "loading") {
    return (
      <>
        <StackHeader title={t("settings.festival")} backTo="/settings" />
        <div className="screen">
          <LoadingState />
        </div>
      </>
    );
  }
  if (status === "error" || !lineup) {
    return (
      <>
        <StackHeader title={t("settings.festival")} backTo="/settings" />
        <div className="screen">
          <ErrorState message={error ?? "Could not load."} onRetry={reload} />
        </div>
      </>
    );
  }

  const persist = (nextChoice: WeekendChoice, nextDays: Set<string> | null): void => {
    const ids = nextChoice === "both" ? weekends.map((w) => w.id) : [nextChoice];
    const dayInfos = daysForWeekends(lineup, ids);
    const dayKeys = [...(nextDays ?? new Set(dayInfos.map((d) => d.key)))];
    save({
      festivalId: lineup.festival.id,
      weekendIds: ids,
      dayKeys,
      completed: true,
      ...(onboarding?.seenActKeys ? { seenActKeys: onboarding.seenActKeys } : {}),
    });
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 1600);
  };

  const chooseWeekend = (id: WeekendChoice): void => {
    setChoice(id);
    setSelectedDays(null); // a new weekend starts with all its days selected
    persist(id, null);
  };

  const toggleDay = (key: string): void => {
    const base = selectedDays ?? new Set(days.map((d) => d.key));
    const next = new Set(base);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    if (next.size === 0) return; // keep at least one day
    setSelectedDays(next);
    persist(choice, next);
  };

  return (
    <>
      <StackHeader title={t("settings.festival")} backTo="/settings" />
      <div className="screen">
        <section className="glass" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
            <span className="label">{t("festival.weekendQ")}</span>
            <span className={`save-flash${justSaved ? " on" : ""}`} aria-live="polite">
              <span className="ms" style={{ fontSize: 16 }}>check_circle</span>
              {t("festival.saved")}
            </span>
          </div>
          <p className="row-sub" style={{ margin: "6px 0 12px" }}>{t("festival.weekendNote")}</p>
          <div className="ob-options" style={{ gap: 8 }}>
            {weekends.map((w) => (
              <button
                key={w.id}
                className={`opt${choice === w.id ? " sel" : ""}`}
                aria-pressed={choice === w.id}
                onClick={() => chooseWeekend(w.id)}
              >
                <span className="opt-main">
                  <span className="opt-title">{w.name}</span>
                  <span className="opt-sub">{weekendDates(w) || "Dates TBA"}</span>
                </span>
                <span className="ms check">check_circle</span>
              </button>
            ))}
            {weekends.length > 1 && (
              <button
                className={`opt${choice === "both" ? " sel" : ""}`}
                aria-pressed={choice === "both"}
                onClick={() => chooseWeekend("both")}
              >
                <span className="opt-main">
                  <span className="opt-title">{t("festival.both")}</span>
                  <span className="opt-sub">{t("festival.bothSub")}</span>
                </span>
                <span className="ms check">check_circle</span>
              </button>
            )}
          </div>
        </section>

        {days.length > 1 && (
          <section className="glass" style={{ padding: 16 }}>
            <span className="label">{t("festival.daysQ")}</span>
            <p className="row-sub" style={{ margin: "6px 0 12px" }}>{t("festival.daysNote")}</p>
            <div className="ob-options" style={{ gap: 8 }}>
              {days.map((d) => (
                <button
                  key={d.key}
                  className={`opt${activeDayKeys.has(d.key) ? " sel" : ""}`}
                  aria-pressed={activeDayKeys.has(d.key)}
                  onClick={() => toggleDay(d.key)}
                >
                  <span className="opt-main">
                    <span className="opt-title">{d.weekdayLong}</span>
                    <span className="opt-sub">{d.dateLabel}</span>
                  </span>
                  <span className="ms check">check_circle</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
