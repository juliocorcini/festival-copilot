/**
 * Pure presentation helpers for group events (Phase 8 — roadmap D2). Framework-free so the live
 * lifecycle, the ticking countdown and the badge are unit-tested in one place; the screens just
 * render their output. The server sends a `lifecycle` computed at read time, but the client
 * RE-DERIVES it here from the timestamps so the countdown stays honest as the clock ticks (the same
 * split meeting points use with `closesInLabel`).
 */
import type { GroupEventLifecycle } from "../../data/types";

/** Inside this window before the start → "soon" (kept in sync with the server's domain/groupEvent). */
export const EVENT_SOON_MS = 30 * 60_000;

/** Re-derive the live lifecycle from the window + now (client-side, ticking). */
export function eventLifecycleFromIso(startsAtUtc: string, endsAtUtc: string, nowMs: number): GroupEventLifecycle {
  const start = Date.parse(startsAtUtc);
  const end = Date.parse(endsAtUtc);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "upcoming";
  if (nowMs >= end) return "past";
  if (nowMs >= start) return "live";
  if (start - nowMs <= EVENT_SOON_MS) return "soon";
  return "upcoming";
}

/** "1m" / "25m" / "2h" / "2h 10m" — a compact human duration from a minute count. */
export function durationLabel(totalMin: number): string {
  const mins = Math.max(0, Math.round(totalMin));
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** The agenda/home countdown: "in 2h 10m" / "in 25m" / "live now" / "ended". */
export function eventCountdown(startsAtUtc: string, endsAtUtc: string, nowMs: number): string {
  const lifecycle = eventLifecycleFromIso(startsAtUtc, endsAtUtc, nowMs);
  if (lifecycle === "past") return "ended";
  if (lifecycle === "live") return "live now";
  const mins = (Date.parse(startsAtUtc) - nowMs) / 60_000;
  return `in ${durationLabel(mins)}`;
}

export interface EventBadge {
  label: string;
  /** Reuses the meeting-point pill tones (go = live green, warn = soon amber, active = upcoming, dead = past). */
  tone: "go" | "warn" | "active" | "dead";
}

export function eventBadge(lifecycle: GroupEventLifecycle): EventBadge {
  switch (lifecycle) {
    case "live":
      return { label: "Live now", tone: "go" };
    case "soon":
      return { label: "Coming up", tone: "warn" };
    case "past":
      return { label: "Ended", tone: "dead" };
    default:
      return { label: "Upcoming", tone: "active" };
  }
}
