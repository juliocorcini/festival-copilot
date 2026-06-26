/**
 * Build the ready-to-render data for the Artist Detail Sheet (ART-4): one artist's photo, name,
 * social links and every place/time it plays — including multiple stages/weekends.
 *
 * Pure (no DOM/React), so it is unit-tested with concrete instants. It reuses `toPlannableSets`
 * (the act's timed sets + resolved stage names) and `timeInZone`/`stageColor` — no new time math.
 *
 * Day/date labels come from each slot's OWN start instant in the festival timezone, NOT from the
 * weekend-merged `DayInfo` list: that list collapses W1-FRIDAY and W2-FRIDAY into a single entry
 * (earliest start), which would mislabel the date of a two-weekend act. The slot instant is always
 * weekend- and timezone-correct, which is exactly what a "where & when" sheet must show.
 */
import type { ArtistSocials, StageDto, WeekendDto } from "../data/types";
import { stageColor, timeInZone } from "../lib/format";
import type { Act } from "./lineup";
import { toPlannableSets } from "./lineup";

/** One place/time the artist plays, fully labelled for display. */
export interface ArtistSlot {
  stageName: string;
  /** Resolved stage colour (a CSS custom-property reference, e.g. "var(--s-main)"). */
  stageColorKey: string;
  /** Weekday in the festival timezone, e.g. "Saturday". */
  dayLabel: string;
  /** Calendar date in the festival timezone, e.g. "Jul 18". */
  dateLabel: string;
  /** Start time "HH:mm" in the festival timezone. */
  start: string;
  /** End time "HH:mm" in the festival timezone. */
  end: string;
  /** Weekend name ("W1"/"W2") for multi-weekend festivals; null when unknown. */
  weekendName: string | null;
}

export interface ArtistDetail {
  name: string;
  imageUrl: string | null;
  /** Present social links only (possibly empty when the artist has none). */
  socials: ArtistSocials;
  /** Every performance of this act, ordered by start instant. */
  slots: ArtistSlot[];
}

function weekdayInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(new Date(ms));
}

function dateInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone }).format(new Date(ms));
}

export function buildArtistDetail(
  act: Act,
  stages: StageDto[],
  weekends: WeekendDto[],
  timeZone: string
): ArtistDetail {
  const weekendNameById = new Map(weekends.map((w) => [w.id, w.name]));
  const slots: ArtistSlot[] = toPlannableSets(act.performances, stages)
    .sort((a, b) => a.startMs - b.startMs)
    .map((set) => ({
      stageName: set.stageName,
      stageColorKey: stageColor(set.stageName),
      dayLabel: weekdayInZone(set.startMs, timeZone),
      dateLabel: dateInZone(set.startMs, timeZone),
      start: timeInZone(new Date(set.startMs).toISOString(), timeZone),
      end: timeInZone(new Date(set.endMs).toISOString(), timeZone),
      weekendName: set.weekendId ? weekendNameById.get(set.weekendId) ?? null : null,
    }));

  return {
    name: act.label,
    imageUrl: act.imageUrl,
    socials: act.socials ?? {},
    slots,
  };
}
