/**
 * Pure helpers for the "Squad now" home bridge (Phase 9 — D4). Kept framework-free so the two bits
 * with real branching — the presence one-liner and the meeting-point badge — are unit-tested in one
 * place; the card component just renders their output. Reuses the squad-home roster grouping and the
 * event badge tones so the home card reads exactly like the squad screens it summarises.
 */
import type { MeetingPointDto } from "../../data/types";
import type { RosterPlace } from "../presence/presenceUi";
import type { EventBadge } from "./eventsUi";

export interface PresenceSummary {
  /** "3 at FREEDOM · 1 between A & B · +2 more", or the empty-roster fallback. */
  text: string;
  /** True when no one is sharing a live spot — the card renders it muted. */
  muted: boolean;
}

/** Collapse the live roster into a compact "who's where" line (top two places + an overflow tally). */
export function presenceSummary(places: RosterPlace[]): PresenceSummary {
  const live = places.filter((p) => p.kind !== "off");
  if (live.length === 0) return { text: "No one's sharing their spot yet", muted: true };

  const parts = live.slice(0, 2).map((p) => {
    const n = p.members.length;
    if (p.kind === "stage") return `${n} at ${p.label}`;
    if (p.kind === "between") return `${n} between ${p.label}`;
    return `${n} in the venue`;
  });
  const rest = live.slice(2).reduce((sum, p) => sum + p.members.length, 0);
  if (rest > 0) parts.push(`+${rest} more`);

  return { text: parts.join(" \u00B7 "), muted: false };
}

/** Map a meeting point's state onto the same pill tones the events use, so the rows read alike. */
export function pointBadge(point: MeetingPointDto): EventBadge {
  if (point.isSafety) return { label: "Safety", tone: "warn" };
  if (point.everyoneHere || point.lifecycle === "everyone_here") return { label: "All here", tone: "go" };
  if (point.lifecycle === "expiring_soon") return { label: "Wrapping up", tone: "warn" };
  return { label: "Meeting point", tone: "go" };
}

/** First meeting point still relevant to the squad (not expired/cancelled), if any. */
export function firstActivePoint(points: MeetingPointDto[]): MeetingPointDto | null {
  return points.find((p) => p.lifecycle !== "expired" && p.lifecycle !== "cancelled") ?? null;
}
