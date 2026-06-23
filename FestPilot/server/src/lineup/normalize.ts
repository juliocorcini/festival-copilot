// Normalize the raw CDN JSON into clean domain objects.
// Handles: festival timezone offset, the +1-second end-time quirk, and
// midnight-crossing sets (a 00:30 set belongs to the previous festival day).
// Ported from spikes/lineup-ingestion/src/normalize.ts.

import type {
  NormalizedLineup,
  Performance,
  SourceConfig,
  SourcePerformance,
  SourceStages,
  SourceWeekendFile,
  Stage,
  Weekend,
} from "./types";

export const TOMORROWLAND_TZ = "Europe/Brussels";

/** Parse "2026-07-17 21:00:00+02:00" (space-separated) into an absolute instant. */
export function toInstant(raw: string): Date {
  const iso = raw.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Unparseable datetime: ${raw}`);
  return d;
}

/** The calendar date portion ("2026-07-19") in the source's local time. */
export function localDate(raw: string): string {
  return raw.slice(0, 10);
}

/**
 * The source encodes end times one second past the real end (e.g. 23:00:01).
 * Floor any non-zero seconds back to the minute. Returns the corrected ISO and a flag.
 */
export function floorSeconds(raw: string): { iso: string; fixed: boolean } {
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(.*)$/);
  if (!m) return { iso: raw.replace(" ", "T"), fixed: false };
  const [, date, hh, mm, ss, tz] = m;
  const fixed = ss !== "00";
  return { iso: `${date}T${hh}:${mm}:00${tz ?? ""}`, fixed };
}

const PLACEHOLDER = /more to be announced/i;

export function normalizePerformance(p: SourcePerformance, weekend: string): Performance {
  const startAt = toInstant(p.startTime);
  const end = floorSeconds(p.endTime);
  const endAt = toInstant(end.iso);
  const durationMinutes = Math.round((endAt.getTime() - startAt.getTime()) / 60_000);
  const crossesMidnight = localDate(p.endTime) !== localDate(p.startTime);
  const isPlaceholder =
    PLACEHOLDER.test(p.name) || (p.artists.length > 0 && p.artists.every((a) => PLACEHOLDER.test(a.name)));

  return {
    sourceId: p.id,
    name: p.name,
    artists: p.artists.map((a) => ({ id: a.id, name: a.name, image: a.image })),
    stageId: p.stage.id,
    stageName: p.stage.name,
    weekend,
    festivalDay: p.day,
    date: localDate(p.startTime),
    startAt,
    endAt,
    rawStartTime: p.startTime,
    rawEndTime: p.endTime,
    durationMinutes,
    crossesMidnight,
    endTimeFixed: end.fixed,
    isPlaceholder,
  };
}

export function normalizeWeekends(config: SourceConfig): Weekend[] {
  return config.config.weekends.map((w) => ({
    name: w.name,
    startDate: w.startDate,
    endDate: w.endDate,
  }));
}

export function normalizeStages(stages: SourceStages): Stage[] {
  return stages.stages.map((s) => ({ sourceId: s.id, name: s.name }));
}

export function buildNormalizedLineup(input: {
  event: string;
  uuid: string;
  config: SourceConfig;
  stages: SourceStages;
  weekendFiles: Array<{ name: string; file: SourceWeekendFile }>;
}): NormalizedLineup {
  const performances: Performance[] = [];
  for (const { name, file } of input.weekendFiles) {
    for (const p of file.performances) performances.push(normalizePerformance(p, name));
  }
  performances.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return {
    event: input.event,
    uuid: input.uuid,
    timezone: TOMORROWLAND_TZ,
    weekends: normalizeWeekends(input.config),
    stages: normalizeStages(input.stages),
    performances,
  };
}

/** Two performances clash if their time intervals overlap (the core of Pillar 2). */
export function overlaps(a: Performance, b: Performance): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}
