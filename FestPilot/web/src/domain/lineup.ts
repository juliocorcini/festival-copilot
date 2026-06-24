/**
 * Map API lineup data into domain shapes.
 *
 * Act identity (DEC-026/028): favoriting is about *people*, so a real artist is keyed by its
 * stable artist id and therefore deduped across multiple days/stages. Acts with no resolved
 * artist (e.g. "More to be announced") fall back to the unique performance id so placeholders
 * never merge into one another.
 */
import type { PerformanceDto, StageDto } from "../data/types";
import type { PlannableSet } from "./types";

export interface Act {
  actKey: string;
  label: string;
  imageUrl: string | null;
  performances: PerformanceDto[];
  stageIds: string[];
  days: string[];
}

export function actKey(performance: PerformanceDto): string {
  return performance.artists[0]?.id ?? performance.id;
}

export function actLabel(performance: PerformanceDto): string {
  const name = performance.name?.trim();
  if (name) return name;
  const fromArtists = performance.artists.map((a) => a.name).filter(Boolean).join(", ");
  return fromArtists || "To be announced";
}

function stageNameMap(stages: StageDto[]): Map<string, string> {
  return new Map(stages.map((stage) => [stage.id, stage.name]));
}

/**
 * Unique acts for browsing/onboarding (placeholders excluded), sorted alphabetically.
 * `dayOf` resolves the day an act plays (defaults to the source label); onboarding passes the derived
 * festival-day id (DEC-048) so the day filter and day tag match the timetable's blocks.
 */
export function uniqueActs(
  performances: PerformanceDto[],
  options: { includePlaceholders?: boolean; dayOf?: (performance: PerformanceDto) => string | null } = {}
): Act[] {
  const dayOf = options.dayOf ?? ((performance: PerformanceDto): string | null => performance.day);
  const byKey = new Map<string, Act>();
  for (const performance of performances) {
    if (!options.includePlaceholders && performance.isPlaceholder) continue;
    const key = actKey(performance);
    const day = dayOf(performance);
    const existing = byKey.get(key);
    if (existing) {
      existing.performances.push(performance);
      if (performance.stageId && !existing.stageIds.includes(performance.stageId)) {
        existing.stageIds.push(performance.stageId);
      }
      if (day && !existing.days.includes(day)) existing.days.push(day);
      if (!existing.imageUrl) existing.imageUrl = performance.artists[0]?.imageUrl ?? null;
    } else {
      byKey.set(key, {
        actKey: key,
        label: actLabel(performance),
        imageUrl: performance.artists[0]?.imageUrl ?? null,
        performances: [performance],
        stageIds: performance.stageId ? [performance.stageId] : [],
        days: day ? [day] : [],
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Performances that can be scheduled (have a valid time window and are not placeholders). */
export function toPlannableSets(performances: PerformanceDto[], stages: StageDto[]): PlannableSet[] {
  const names = stageNameMap(stages);
  const sets: PlannableSet[] = [];
  for (const performance of performances) {
    if (performance.isPlaceholder) continue;
    if (!performance.startAtUtc || !performance.endAtUtc) continue;
    const startMs = Date.parse(performance.startAtUtc);
    const endMs = Date.parse(performance.endAtUtc);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) continue;
    sets.push({
      id: performance.id,
      actKey: actKey(performance),
      label: actLabel(performance),
      stageId: performance.stageId,
      stageName: (performance.stageId && names.get(performance.stageId)) || "—",
      startMs,
      endMs,
      day: performance.day,
      weekendId: performance.weekendId,
    });
  }
  return sets;
}

/** Subset of plannable sets whose act is favorited — the resolver's input. */
export function favoriteSets(
  performances: PerformanceDto[],
  stages: StageDto[],
  favoriteKeys: ReadonlySet<string>
): PlannableSet[] {
  return toPlannableSets(performances, stages).filter((set) => favoriteKeys.has(set.actKey));
}

/**
 * Sets that play around a time window (for "add an artist around this time", #12c). A set qualifies
 * if it overlaps the window; excluded act keys (already in the clash / already chosen) are removed.
 * Sorted by start so the closest-starting options come first.
 */
export function nearbySets(
  performances: PerformanceDto[],
  stages: StageDto[],
  window: { startMs: number; endMs: number },
  options: { excludeActKeys?: ReadonlySet<string>; dayKey?: string | null } = {}
): PlannableSet[] {
  const exclude = options.excludeActKeys ?? new Set<string>();
  return toPlannableSets(performances, stages)
    .filter((set) => {
      if (options.dayKey && set.day !== options.dayKey) return false;
      if (exclude.has(set.actKey)) return false;
      return set.startMs < window.endMs && set.endMs > window.startMs;
    })
    .sort((a, b) => a.startMs - b.startMs);
}
