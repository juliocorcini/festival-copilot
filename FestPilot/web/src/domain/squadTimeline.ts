/**
 * Render-only merge of the squad's set plan with its group-event agenda (D23 · DEC-086).
 *
 * HARD ANCHOR: this NEVER touches the aggregation. `buildSquadPlan` stays pure and sets-only; group
 * events are a PARALLEL lane that we interleave **for display** by start time. The output references
 * the original blocks/events untouched, and filtering it back to `kind === "set"` returns exactly the
 * input blocks in order — the invariant the regression test pins (an event can never enter, reorder
 * or drop a set). A set↔event time overlap is a label ("during {set}"), never a resolution.
 */
import type { SquadBlock } from "./squadPlan";

/** Minimal shape of a group event needed to place it on the timeline (`GroupEventDto` satisfies it). */
export interface TimelineEvent {
  id: string;
  title: string;
  stageName: string | null;
  startsAtUtc: string;
  endsAtUtc: string;
}

export type SquadTimelineItem =
  | { kind: "set"; startMs: number; block: SquadBlock }
  | { kind: "event"; startMs: number; endMs: number; event: TimelineEvent };

/** Interleave aggregated set blocks and group events into one time-ordered render list. Pure. */
export function mergeSquadTimeline(blocks: SquadBlock[], events: TimelineEvent[]): SquadTimelineItem[] {
  const items: SquadTimelineItem[] = blocks.map((block) => ({ kind: "set", startMs: block.set.startMs, block }));

  for (const event of events) {
    const startMs = Date.parse(event.startsAtUtc);
    const endMs = Date.parse(event.endsAtUtc);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    items.push({ kind: "event", startMs, endMs, event });
  }

  // Stable order: by start; ties keep the set (plan backbone) ahead of the event, then by title.
  return items.sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    if (a.kind !== b.kind) return a.kind === "set" ? -1 : 1;
    return titleOf(a).localeCompare(titleOf(b));
  });
}

/** The set/event a timeline item overlaps in time → drives the "during {label}" hint. Pure, read-only. */
export function eventClashLabel(event: TimelineEvent, blocks: SquadBlock[]): string | null {
  const startMs = Date.parse(event.startsAtUtc);
  const endMs = Date.parse(event.endsAtUtc);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const hit = blocks.find((b) => b.set.startMs < endMs && b.set.endMs > startMs);
  return hit ? hit.set.label : null;
}

function titleOf(item: SquadTimelineItem): string {
  return item.kind === "set" ? item.block.set.label : item.event.title;
}

/**
 * Keep only events whose `startsAtUtc` falls within the given day window [dayStartMs, dayEndMs).
 * Pure helper for the SquadPlanScreen day filter (F02 / DEC-110).
 */
export function eventsForDay<T extends { startsAtUtc: string }>(events: T[], dayStartMs: number, dayEndMs: number): T[] {
  return events.filter((e) => {
    const ms = Date.parse(e.startsAtUtc);
    return Number.isFinite(ms) && ms >= dayStartMs && ms < dayEndMs;
  });
}
