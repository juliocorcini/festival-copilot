/** Presentation helpers for festival weekends and days, derived from lineup DTOs. */
import type { LineupDto, PerformanceDto, WeekendDto } from "../data/types";
import { assignFestivalDays } from "../domain/festivalDay";
import { actKey, performancesForWeekends } from "../domain/lineup";

export interface DayInfo {
  key: string;
  weekendId: string | null;
  startMs: number;
  weekdayShort: string;
  weekdayLong: string;
  dateLabel: string;
}

/**
 * Distinct festival days for the chosen weekends, ordered by first set, labelled in the festival tz.
 * Days are the derived contiguous blocks (DEC-048), so a 00:30 set shows under the night it belongs to
 * and the key stays the source day label ("FRIDAY") that persisted plans/onboarding are stored under.
 */
export function daysForWeekends(lineup: LineupDto, weekendIds: string[], locale?: string): DayInfo[] {
  const tz = lineup.festival.timezone;
  const scoped = performancesForWeekends(lineup.performances, weekendIds);

  const blocks = assignFestivalDays(scoped);
  if (blocks.length === 0) return legacyDaysByLabel(scoped);

  // Merge blocks that share an id (e.g. W1 + W2 both yield "FRIDAY") so the day key stays
  // weekend-agnostic, matching how plans are keyed. Earliest start wins for ordering and labels.
  const byId = new Map<string, DayInfo>();
  for (const block of blocks) {
    const existing = byId.get(block.id);
    if (existing) {
      if (block.startMs < existing.startMs) {
        existing.startMs = block.startMs;
        existing.weekendId = block.weekendId;
        applyLabels(existing, block.startMs, tz, locale);
      }
      continue;
    }
    const info: DayInfo = {
      key: block.id,
      weekendId: block.weekendId,
      startMs: block.startMs,
      weekdayShort: block.id,
      weekdayLong: block.id,
      dateLabel: "",
    };
    applyLabels(info, block.startMs, tz, locale);
    byId.set(block.id, info);
  }

  return [...byId.values()].sort((a, b) => a.startMs - b.startMs);
}

/**
 * The day in focus right now: the latest day whose first set has already started, else the first day.
 * Days must be start-ordered (as `daysForWeekends` returns them). Shared by the Now home and the
 * reminder scheduler so both agree on "today" without duplicating the loop.
 */
export function pickActiveDay<T extends { startMs: number }>(days: T[], nowMs: number): T | null {
  if (days.length === 0) return null;
  let chosen = days[0]!;
  for (const day of days) {
    if (day.startMs <= nowMs) chosen = day;
    else break;
  }
  return chosen;
}

/** Fallback for a lineup published without any scheduled times yet (DEC-049): group by source label. */
function legacyDaysByLabel(performances: PerformanceDto[]): DayInfo[] {
  const byDay = new Map<string, DayInfo>();
  for (const performance of performances) {
    if (!performance.day || byDay.has(performance.day)) continue;
    byDay.set(performance.day, {
      key: performance.day,
      weekendId: performance.weekendId,
      startMs: Number.POSITIVE_INFINITY,
      weekdayShort: performance.day,
      weekdayLong: performance.day,
      dateLabel: "",
    });
  }
  return [...byDay.values()];
}

function applyLabels(info: DayInfo, ms: number, tz: string, locale = "en-US"): void {
  const date = new Date(ms);
  info.weekdayShort = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: tz }).format(date);
  info.weekdayLong = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: tz }).format(date);
  info.dateLabel = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: tz }).format(date);
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

/** Day-of-month number in the festival tz (e.g. "25"); shared by the day dropdown trigger (DAY-1). */
export function dayOfMonth(startMs: number, timeZone: string): string {
  if (!Number.isFinite(startMs)) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone }).format(startMs);
}

/**
 * Favorited acts per day key (DAY-2), for the ★ badge in the day dropdown. An act that plays on two
 * days counts once on each; the same act twice in one day counts once. Days with no favorite are
 * absent from the map. Pure — keyed by the weekend-agnostic source day, matching how plans are keyed.
 */
export function countFavoritesPerDay(
  performances: PerformanceDto[],
  favoriteKeys: ReadonlySet<string>,
  days: DayInfo[]
): Map<string, number> {
  const validKeys = new Set(days.map((day) => day.key));
  const actsByDay = new Map<string, Set<string>>();
  for (const performance of performances) {
    const day = performance.day;
    if (!day || !validKeys.has(day)) continue;
    const key = actKey(performance);
    if (!favoriteKeys.has(key)) continue;
    const bucket = actsByDay.get(day) ?? new Set<string>();
    bucket.add(key);
    actsByDay.set(day, bucket);
  }
  const counts = new Map<string, number>();
  for (const [day, keys] of actsByDay) counts.set(day, keys.size);
  return counts;
}
