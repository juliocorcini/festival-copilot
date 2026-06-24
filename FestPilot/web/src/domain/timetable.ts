/**
 * Pure layout model for the TML-style timetable (DEC-027): rows = stages, columns = time.
 * Positions are returned as percentages of a time window snapped to whole LOCAL hours, so the
 * presentation layer only multiplies by a pixels-per-hour zoom factor. No DOM, no React — fully
 * unit-testable with concrete numbers (use `timeZone: "UTC"` for offset-free assertions).
 */
import type { PerformanceDto, StageDto } from "../data/types";
import { toPlannableSets } from "./lineup";

const HOUR_MS = 3_600_000;

export interface TimetableSet {
  id: string;
  actKey: string;
  label: string;
  stageId: string | null;
  startMs: number;
  endMs: number;
  leftPct: number;
  widthPct: number;
  isFav: boolean;
}

export interface TimetableStage {
  id: string;
  name: string;
  sortOrder: number;
  hasFav: boolean;
  sets: TimetableSet[];
}

export interface HourMark {
  ms: number;
  leftPct: number;
}

export interface TimetableModel {
  windowStartMs: number;
  windowEndMs: number;
  totalMs: number;
  totalHours: number;
  hourMarks: HourMark[];
  stages: TimetableStage[];
  isEmpty: boolean;
}

export interface BuildTimetableInput {
  performances: PerformanceDto[];
  stages: StageDto[];
  favorites: ReadonlySet<string>;
  /** Festival day key (e.g. "FRIDAY"); `null` shows every day. */
  dayKey: string | null;
  /** Weekend scope; empty = all weekends. */
  weekendIds: string[];
  timeZone: string;
}

/** Offset in minutes (east-positive) of `timeZone` at `ms`, via Intl — used to snap to local hours. */
export function tzOffsetMinutes(ms: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(ms))) parts[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - ms) / 60_000);
}

function snapToLocalHour(ms: number, timeZone: string, mode: "floor" | "ceil"): number {
  const offset = tzOffsetMinutes(ms, timeZone) * 60_000;
  const local = ms + offset;
  const snapped = (mode === "floor" ? Math.floor(local / HOUR_MS) : Math.ceil(local / HOUR_MS)) * HOUR_MS;
  return snapped - offset;
}

/** Build the positioned grid for a single festival day. */
export function buildTimetable(input: BuildTimetableInput): TimetableModel {
  const { performances, stages, favorites, dayKey, weekendIds, timeZone } = input;
  const weekendScope = new Set(weekendIds);

  const sets = toPlannableSets(performances, stages).filter((set) => {
    if (dayKey && set.day !== dayKey) return false;
    if (weekendScope.size > 0 && set.weekendId && !weekendScope.has(set.weekendId)) return false;
    return true;
  });

  if (sets.length === 0) {
    return { windowStartMs: 0, windowEndMs: 0, totalMs: 0, totalHours: 0, hourMarks: [], stages: [], isEmpty: true };
  }

  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const set of sets) {
    if (set.startMs < minStart) minStart = set.startMs;
    if (set.endMs > maxEnd) maxEnd = set.endMs;
  }

  const windowStartMs = snapToLocalHour(minStart, timeZone, "floor");
  const windowEndMs = snapToLocalHour(maxEnd, timeZone, "ceil");
  const totalMs = Math.max(windowEndMs - windowStartMs, HOUR_MS);
  const pct = (ms: number): number => ((ms - windowStartMs) / totalMs) * 100;

  const hourMarks: HourMark[] = [];
  for (let t = windowStartMs; t <= windowEndMs; t += HOUR_MS) {
    hourMarks.push({ ms: t, leftPct: pct(t) });
  }

  const sortOrderById = new Map(stages.map((stage) => [stage.id, stage.sortOrder]));
  const nameById = new Map(stages.map((stage) => [stage.id, stage.name]));
  const byStage = new Map<string, TimetableSet[]>();

  for (const set of sets) {
    const stageId = set.stageId ?? "—";
    const entry: TimetableSet = {
      id: set.id,
      actKey: set.actKey,
      label: set.label,
      stageId: set.stageId,
      startMs: set.startMs,
      endMs: set.endMs,
      leftPct: pct(set.startMs),
      widthPct: ((set.endMs - set.startMs) / totalMs) * 100,
      isFav: favorites.has(set.actKey),
    };
    const bucket = byStage.get(stageId);
    if (bucket) bucket.push(entry);
    else byStage.set(stageId, [entry]);
  }

  const stagesOut: TimetableStage[] = [...byStage.entries()]
    .map(([id, entries]) => {
      entries.sort((a, b) => a.startMs - b.startMs);
      return {
        id,
        name: nameById.get(id) ?? "—",
        sortOrder: sortOrderById.get(id) ?? Number.MAX_SAFE_INTEGER,
        hasFav: entries.some((entry) => entry.isFav),
        sets: entries,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  return {
    windowStartMs,
    windowEndMs,
    totalMs,
    totalHours: totalMs / HOUR_MS,
    hourMarks,
    stages: stagesOut,
    isEmpty: false,
  };
}
