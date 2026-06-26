/**
 * DAY-1: compact day selector (V8). Replaces the horizontally-scrolling day pills with a single
 * trigger ("📅 Sat 25 ▾") that opens a vertical dropdown — one row per day with its number, weekday,
 * full date and a ★ favorites count. Pure presentation: the selected-day state lives in the screen.
 */
import { useEffect, useRef, useState } from "react";
import { dayOfMonth, type DayInfo } from "../lib/festival";

export function DayDropdown({
  days,
  dayKey,
  tz,
  favByDay,
  onSelect,
}: {
  days: DayInfo[];
  dayKey: string | null;
  tz: string;
  favByDay: Map<string, number>;
  onSelect: (key: string) => void;
}): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (days.length === 0) return null;

  const selected = days.find((day) => day.key === dayKey) ?? days[0]!;
  const choose = (key: string): void => {
    onSelect(key);
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
        aria-label="Select day"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ms cal" aria-hidden="true">calendar_month</span>
        {selected.weekdayShort} {dayOfMonth(selected.startMs, tz)}
        <span className="ms cv" aria-hidden="true">expand_more</span>
      </button>
      {open && (
        <>
          <div className="dd-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="day-dd" role="listbox" aria-label="Festival days">
            <div className="dd-ti">Choose a day</div>
            {days.map((day, i) => {
              const on = day.key === selected.key;
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
                  <span className="dd-dn">Day {i + 1}</span>
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
