// Types for the Tomorrowland structured lineup source and our normalized domain.
// Ported verbatim from spikes/lineup-ingestion/src/types.ts (source shapes confirmed
// from a real HAR capture, event TL26BE).

// ---- Source (raw CDN JSON) ----

export interface SourceConfig {
  config: {
    weekends: Array<{ name: string; startDate: string; endDate: string }>;
    withTimetable: boolean;
  };
}

export interface SourceStage {
  id: string;
  name: string;
  hosts: Record<string, string>;
  mtba: boolean;
  more_to_be_announced: Record<string, boolean>;
}

export interface SourceStages {
  stages: SourceStage[];
}

export interface SourceArtist {
  id: string;
  name: string;
  image?: string;
}

export interface SourcePerformance {
  id: string;
  name: string;
  artists: SourceArtist[];
  stage: { id: string; name: string };
  date: string; // "2026-07-19"
  day: string; // festival day label, e.g. "SATURDAY" (may differ from calendar date after midnight)
  startTime: string; // "2026-07-17 21:00:00+02:00"
  endTime: string; // "2026-07-17 23:00:01+02:00"  <- note the +1s quirk
}

export interface SourceWeekendFile {
  performances: SourcePerformance[];
}

// ---- Normalized domain ----

export interface Weekend {
  name: string; // "W1"
  startDate: string;
  endDate: string;
}

export interface Stage {
  sourceId: string;
  name: string;
}

export interface Performance {
  sourceId: string;
  name: string;
  artists: SourceArtist[];
  stageId: string;
  stageName: string;
  weekend: string; // "W1"
  festivalDay: string; // "SATURDAY" — groups post-midnight sets with the night they belong to
  date: string; // calendar date of start, "2026-07-19"
  startAt: Date; // absolute instant
  endAt: Date; // absolute instant, +1s quirk stripped, midnight handled
  rawStartTime: string;
  rawEndTime: string;
  durationMinutes: number;
  crossesMidnight: boolean;
  endTimeFixed: boolean; // true when the +1s quirk was corrected
  isPlaceholder: boolean; // "More to be announced"
}

export interface NormalizedLineup {
  event: string;
  uuid: string;
  timezone: string;
  weekends: Weekend[];
  stages: Stage[];
  performances: Performance[];
}
