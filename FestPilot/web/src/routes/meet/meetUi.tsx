/**
 * Pure presentation helpers for the meeting-point detail (#26.3/#26.4). Kept framework-free so the
 * lifecycle badge, the per-member status line (here / ETA / no-response / can't), the ETA formatting
 * and the convergence summary are all unit-tested in one place — the screen just renders their output.
 */
import type { MeetingLifecycle, MeetingPointDto, MeetingPointMemberDto } from "../../data/types";

export interface LifecycleBadge {
  label: string;
  /** Drives the pill colour: live amber, heading green, reunion green, closing amber, dead grey. */
  tone: "active" | "go" | "done" | "warn" | "dead";
}

export function lifecycleBadge(lifecycle: MeetingLifecycle): LifecycleBadge {
  switch (lifecycle) {
    case "everyone_here":
      return { label: "Everyone's here", tone: "done" };
    case "on_the_way":
      return { label: "On the way", tone: "go" };
    case "expiring_soon":
      return { label: "Closing soon", tone: "warn" };
    case "expired":
      return { label: "Closed", tone: "dead" };
    case "cancelled":
      return { label: "Cancelled", tone: "dead" };
    default:
      return { label: "Active", tone: "active" };
  }
}

export interface MemberStatusLine {
  text: string;
  /** here = arrived (green), eta = heading over, cant = not coming, muted = no response. */
  tone: "here" | "eta" | "cant" | "muted";
  icon: string | null;
}

/** The trailing status a roster row shows for one member (#26.3 "Here" / "~3 min · 220m" / "no response"). */
export function memberStatusLine(m: MeetingPointMemberDto): MemberStatusLine {
  switch (m.status) {
    case "arrived":
      return { text: "Here", tone: "here", icon: "check" };
    case "not_going":
      return { text: "Can't make it", tone: "cant", icon: "do_not_disturb_on" };
    case "no_response":
      return { text: "no response", tone: "muted", icon: null };
    case "left":
      return { text: "left", tone: "muted", icon: null };
    case "going":
    default:
      if (m.etaMinutes != null) return { text: etaLabel(m.etaMinutes, m.distanceMeters), tone: "eta", icon: null };
      return { text: "on the way", tone: "eta", icon: "directions_walk" };
  }
}

/** "~3 min · 220m" / "~3 min" — pairs the ETA with a clean rounded distance when it's known. */
export function etaLabel(minutes: number, meters: number | null): string {
  return meters != null ? `~${minutes} min · ${formatMeters(meters)}` : `~${minutes} min`;
}

/** Round to a friendly distance ("220m" / "1.2km") — never an exact metre count. */
export function formatMeters(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.max(10, Math.round(meters / 10) * 10)}m`;
}

/** The header tally: "Everyone's here" / "3 on the way · 1 here" / "1 going". */
export function convergenceSummary(point: MeetingPointDto): string {
  if (point.everyoneHere) return "Everyone's here";
  if (point.hereCount > 0) return `${point.goingCount} on the way · ${point.hereCount} here`;
  return `${point.goingCount} going`;
}

/** "closes in 24m" / "closing" from an ISO expiry, or null when it's far off (> 6 h). */
export function closesInLabel(expiresAtUtc: string, nowMs: number = Date.now()): string | null {
  const ms = Date.parse(expiresAtUtc) - nowMs;
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "closing";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `closes in ${min}m`;
  const hr = Math.round(min / 60);
  return hr <= 6 ? `closes in ${hr}h` : null;
}

/** When (#26.2) copy for the detail subtitle: "now" or a local time like "21:30". */
export function whenLabel(meetAtUtc: string | null): string {
  if (!meetAtUtc) return "now";
  const t = Date.parse(meetAtUtc);
  if (!Number.isFinite(t)) return "now";
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
