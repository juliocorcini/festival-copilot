/**
 * "Squad Next up" selector (D20/D24 · DEC-086). Picks the single most relevant thing the squad is
 * doing now/next, so the Squad home and the Home "Squad" tab can answer the exact complaint —
 * *"what's the group doing right now?"* — without a tap.
 *
 * Pure and framework-free. It reads the SAME sources the squad already has (the aggregated squad-plan
 * winners — sets only — group events, and the active meeting point) but NEVER mixes them into the
 * aggregation: this is a read-only view selector. `buildSquadPlan` is untouched; sets arrive here
 * already aggregated. Events are a parallel lane (DEC-D2). The meeting point is a fallback focus.
 *
 * Priority: a LIVE scheduled item (set or event happening now, ending soonest) → the soonest UPCOMING
 * scheduled item → an active meeting point (always "now") → nothing. Among scheduled ties, an event
 * (an intentional group commitment) leads a set, then by title for determinism.
 */
export type SquadFocusKind = "set" | "event" | "meet";

export interface SquadFocus {
  kind: SquadFocusKind;
  title: string;
  /** Secondary line — stage name / landmark — or null. */
  where: string | null;
  /** Start instant (ms) for a set/event; null for an ongoing meeting point. */
  startMs: number | null;
  /** End instant (ms) for a set/event; null for a meeting point. */
  endMs: number | null;
  /** Happening now (start ≤ now < end). A meeting point is always treated as "now". */
  live: boolean;
}

/** Structural inputs — `GroupEventDto` / `PlannableSet` / `MeetingPointDto` satisfy these as-is. */
interface EventLike {
  title: string;
  stageName: string | null;
  startsAtUtc: string;
  endsAtUtc: string;
}
interface SetLike {
  label: string;
  stageName: string;
  startMs: number;
  endMs: number;
}
interface MeetLike {
  title: string;
  landmarkLabel: string;
}

export interface SquadNextUpInput {
  /** Squad-plan winners for the day — SETS ONLY (buildSquadPlan output). Never events. */
  sets: SetLike[];
  /** Group events (parallel agenda lane). */
  events: EventLike[];
  /** The active meeting point, if any (caller passes `firstActivePoint(points)`), else null. */
  meet: MeetLike | null;
  now: number;
}

interface Scheduled extends SquadFocus {
  startMs: number;
  endMs: number;
}

/** The single squad focus to surface now/next, or null when there's nothing relevant. */
export function squadNextUp(input: SquadNextUpInput): SquadFocus | null {
  const { now } = input;
  const candidates: Scheduled[] = [];

  for (const ev of input.events) {
    const startMs = Date.parse(ev.startsAtUtc);
    const endMs = Date.parse(ev.endsAtUtc);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    candidates.push({ kind: "event", title: ev.title, where: ev.stageName, startMs, endMs, live: startMs <= now && now < endMs });
  }
  for (const s of input.sets) {
    candidates.push({ kind: "set", title: s.label, where: s.stageName || null, startMs: s.startMs, endMs: s.endMs, live: s.startMs <= now && now < s.endMs });
  }

  const upcomingOrLive = candidates.filter((c) => c.endMs > now);
  if (upcomingOrLive.length > 0) {
    upcomingOrLive.sort(compareFocus(now));
    const { kind, title, where, startMs, endMs, live } = upcomingOrLive[0]!;
    return { kind, title, where, startMs, endMs, live };
  }

  if (input.meet) {
    return { kind: "meet", title: input.meet.title, where: input.meet.landmarkLabel || null, startMs: null, endMs: null, live: true };
  }
  return null;
}

/** Live items first (ending soonest), then upcoming (earliest start); ties: event before set, then title. */
function compareFocus(now: number): (a: Scheduled, b: Scheduled) => number {
  return (a, b) => {
    const aLive = a.startMs <= now;
    const bLive = b.startMs <= now;
    if (aLive !== bLive) return aLive ? -1 : 1;
    if (aLive) {
      if (a.endMs !== b.endMs) return a.endMs - b.endMs;
    } else if (a.startMs !== b.startMs) {
      return a.startMs - b.startMs;
    }
    if (a.kind !== b.kind) return a.kind === "event" ? -1 : 1;
    return a.title.localeCompare(b.title);
  };
}
