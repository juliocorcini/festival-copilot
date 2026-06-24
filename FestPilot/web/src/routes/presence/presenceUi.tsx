/** Shared bits for the presence screens (#25): avatar with optional live ring + coarse label text. */
import { initialsOf } from "../../data/identity";
import { readableInkOn } from "../../lib/contrast";
import type { PresenceMemberDto } from "../../data/types";

const FALLBACK_COLOR = "#6B7280";

export function PresenceAvatar({
  name,
  color,
  size = 40,
  live = false,
}: {
  name: string | null;
  color: string | null;
  size?: number;
  live?: boolean;
}): JSX.Element {
  const c = color ?? FALLBACK_COLOR;
  return (
    <span
      className={`ava presence-ava${live ? " is-live" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.3,
        background: `linear-gradient(135deg, ${c}, ${c}cc)`,
        color: readableInkOn(c),
      }}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Compact "now / 4m / 18m" age from seconds. */
export function ago(seconds: number): string {
  if (seconds < 45) return "now";
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  return `${hr}h`;
}

export interface PresenceLine {
  /** The coarse "where" line, e.g. "at MAINSTAGE". */
  text: string;
  /** A secondary clause, e.g. "watching Martin Garrix" or "precise · 47m left". */
  sub: string | null;
  /** Material icon prefixing the line (stage / location_off / etc.). */
  icon: string | null;
  muted: boolean;
}

const COARSE_PREFIX: Record<string, string> = { at: "at", near: "near", between: "between" };

/** Turn a coarse presence DTO into the honest one-liner the roster + map show (never a coordinate). */
export function presenceLine(m: PresenceMemberDto): PresenceLine {
  if (m.shareMode === "ghost") {
    return { text: "not sharing", sub: null, icon: "visibility_off", muted: true };
  }
  const p = m.presence;
  if (!p) {
    return { text: m.isYou ? "share to appear" : "no location yet", sub: null, icon: "location_searching", muted: true };
  }
  if (p.stale) {
    return { text: `last seen ${ago(p.ageSeconds)} ago`, sub: null, icon: "schedule", muted: true };
  }
  let where: string;
  if (p.coarseLabel === "between") {
    where = `between ${p.stageName ?? "—"} & ${p.betweenStageName ?? "—"}`;
  } else if (p.coarseLabel === "none" || !p.stageName) {
    where = "somewhere in the venue";
  } else {
    where = `${COARSE_PREFIX[p.coarseLabel] ?? "near"} ${p.stageName}`;
  }
  const sub = m.live
    ? `precise · ${ago(m.liveSecondsLeft ?? 0)} left`
    : p.currentArtistName
      ? `watching ${p.currentArtistName}`
      : null;
  return { text: where, sub, icon: m.live ? "my_location" : "apartment", muted: false };
}

/** mm:ss countdown for a precise-sharing control. */
export function mmss(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Roster bucket: live first (0), then fresh sharers (1), then stale (2), then ghost / no fix (3). */
export function rosterRank(m: PresenceMemberDto): number {
  if (m.live) return 0;
  if (m.shareMode === "ghost" || !m.presence) return 3;
  return m.presence.stale ? 2 : 1;
}

/** Order the roster by bucket, then by freshness (smallest age first). Stable, non-mutating. */
export function sortRoster(members: PresenceMemberDto[]): PresenceMemberDto[] {
  return [...members].sort((a, b) => {
    const r = rosterRank(a) - rosterRank(b);
    if (r !== 0) return r;
    const aa = a.presence?.ageSeconds ?? Number.POSITIVE_INFINITY;
    const ba = b.presence?.ageSeconds ?? Number.POSITIVE_INFINITY;
    return aa - ba;
  });
}

/** Which ping a member can receive: stale sharer → "locate"; ghost/silent → "nudge"; self → none. */
export function pingKindFor(m: PresenceMemberDto): "locate" | "nudge" | null {
  if (m.isYou) return null;
  if (m.shareMode === "ghost" || !m.presence) return "nudge";
  return m.presence.stale ? "locate" : null;
}
