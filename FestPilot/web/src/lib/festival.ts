/** Presentation helpers for festival weekends and days, derived from lineup DTOs. */
import type { LineupDto, WeekendDto } from "../data/types";

export interface DayInfo {
  key: string;
  weekendId: string | null;
  startMs: number;
  weekdayShort: string;
  weekdayLong: string;
  dateLabel: string;
}

function fmt(utcIso: string, timeZone: string, options: Intl.DateTimeFormatOptions, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(new Date(utcIso));
}

/** Distinct festival days for the chosen weekends, ordered by first set, labelled in the festival tz. */
export function daysForWeekends(lineup: LineupDto, weekendIds: string[]): DayInfo[] {
  const tz = lineup.festival.timezone;
  const byDay = new Map<string, DayInfo & { hasTime: boolean }>();

  for (const performance of lineup.performances) {
    if (!performance.day) continue;
    if (weekendIds.length > 0 && performance.weekendId && !weekendIds.includes(performance.weekendId)) continue;
    const startMs = performance.startAtUtc ? Date.parse(performance.startAtUtc) : NaN;
    const existing = byDay.get(performance.day);
    if (existing) {
      if (Number.isFinite(startMs) && (!existing.hasTime || startMs < existing.startMs)) {
        existing.startMs = startMs;
        existing.hasTime = true;
        applyLabels(existing, performance.startAtUtc!, tz);
      }
      continue;
    }
    const info: DayInfo & { hasTime: boolean } = {
      key: performance.day,
      weekendId: performance.weekendId,
      startMs: Number.isFinite(startMs) ? startMs : Number.POSITIVE_INFINITY,
      weekdayShort: performance.day,
      weekdayLong: performance.day,
      dateLabel: "",
      hasTime: Number.isFinite(startMs),
    };
    if (Number.isFinite(startMs)) applyLabels(info, performance.startAtUtc!, tz);
    byDay.set(performance.day, info);
  }

  return [...byDay.values()]
    .sort((a, b) => a.startMs - b.startMs)
    .map(({ hasTime: _hasTime, ...info }) => info);
}

function applyLabels(info: DayInfo, utcIso: string, tz: string): void {
  info.weekdayShort = fmt(utcIso, tz, { weekday: "short" });
  info.weekdayLong = fmt(utcIso, tz, { weekday: "long" });
  info.dateLabel = fmt(utcIso, tz, { month: "short", day: "numeric" });
}

export function weekendTitle(weekend: WeekendDto): string {
  return weekend.name;
}

/**
 * Parse a weekend boundary to a calendar day (anchored at UTC noon to dodge tz/DST edges).
 * Accepts "YYYY-MM-DD", "YYYY-MM-DD HH:MM" (festival-local, the API shape) and full ISO.
 * An end time in the early morning (before noon) belongs to the previous festival night,
 * so it rolls back a day — matching how post-midnight sets are grouped elsewhere.
 */
function weekendDay(value: string | null, rollEarlyMorning: boolean): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!match) return null;
  const [, year, month, day, hour] = match;
  const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  if (rollEarlyMorning && hour !== undefined && Number(hour) < 12) {
    date.setUTCDate(date.getUTCDate() - 1);
  }
  return date;
}

/** "Jul 16 – 19" style range from a weekend's start/end dates. */
export function weekendDates(weekend: WeekendDto): string {
  const start = weekendDay(weekend.startDate, false);
  const end = weekendDay(weekend.endDate, true);
  if (!start) return "";
  const month = (d: Date): string => new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(d);
  const day = (d: Date): number => d.getUTCDate();
  if (!end || (month(start) === month(end) && day(start) === day(end))) return `${month(start)} ${day(start)}`;
  if (month(start) === month(end)) return `${month(start)} ${day(start)} – ${day(end)}`;
  return `${month(start)} ${day(start)} – ${month(end)} ${day(end)}`;
}

/** Initials (max 2) for an avatar tile, e.g. "Charlotte de Witte" → "CW". */
export function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[words.length - 1]![0]!).toUpperCase();
}
