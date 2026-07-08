/**
 * DAY-1: compact day selector (V8). Replaces the horizontally-scrolling day pills with a single
 * trigger ("📅 Sat 25 ▾") that opens a vertical dropdown — one row per day with its number, weekday,
 * full date and a ★ favorites count. Pure presentation: the selected-day state lives in the screen.
 */
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { dayOfMonth, type DayInfo } from "../lib/festival";

export function DayDropdown({
  days,
  dayKey,
  tz,
  favByDay,
  onSelect,
  showAllOption = false,
  onSelectAll,
}: {
  days: DayInfo[];
  dayKey: string | null;
  tz: string;
  favByDay: Map<string, number>;
  onSelect: (key: string) => void;
  showAllOption?: boolean;
  onSelectAll?: () => void;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (days.length === 0) return null;

  const selected = dayKey ? days.find((day) => day.key === dayKey) : null;
  const isAll = dayKey === null;
  const choose = (key: string): void => {
    onSelect(key);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const chooseAll = (): void => {
    onSelectAll?.();
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="dsel-wrap">
      <button
        ref={triggerRef}
        type="button"
        className={`dsel${open ? " open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("day.select")}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ms cal" aria-hidden="true">calendar_month</span>
        {selected ? `${selected.weekdayShort} ${dayOfMonth(selected.startMs, tz)}` : t("lineup.allDays")}
        <span className="ms cv" aria-hidden="true">expand_more</span>
      </button>
      {open && (
        <>
          <div className="dd-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="day-dd" role="listbox" aria-label={t("day.festivalDays")}>
            <div className="dd-ti">{t("day.choose")}</div>
            {showAllOption && (
              <button
                type="button"
                role="option"
                aria-selected={isAll}
                className={`dd-opt${isAll ? " on" : ""}`}
                onClick={chooseAll}
              >
                <span className="dd-dn">
                  <span className="ms" style={{ fontSize: 14 }}>date_range</span>
                </span>
                <span className="dd-when">
                  <span className="dd-wd">{t("lineup.allDays")}</span>
                </span>
                <span className="dd-rmeta">
                  <span className="ms dd-check" aria-hidden="true">check</span>
                </span>
              </button>
            )}
            {days.map((day, i) => {
              const on = day.key === selected?.key;
              const fav = favByDay.get(day.key) ?? 0;
              return (
                <button
                  key={day.key}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`dd-opt${on ? " on" : ""}`}
                  onClick={() => choose(day.key)}
                >
                  <span className="dd-dn">{t("day.n", { n: i + 1 })}</span>
                  <span className="dd-when">
                    <span className="dd-wd">{day.weekdayLong}</span>
                    {day.dateLabel && <span className="dd-dt">{day.dateLabel}</span>}
                  </span>
                  <span className="dd-rmeta">
                    {fav > 0 && (
                      <span className="dd-fav">
                        <span className="ms" aria-hidden="true">star</span>
                        {fav}
                      </span>
                    )}
                    <span className="ms dd-check" aria-hidden="true">check</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
