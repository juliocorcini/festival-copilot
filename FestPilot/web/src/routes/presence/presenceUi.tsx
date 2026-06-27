/** Shared bits for the presence screens (#25): avatar with optional live ring + coarse label text. */
import { initialsOf } from "../../data/identity";
import { readableInkOn } from "../../lib/contrast";
import type { TranslateFn } from "../../i18n";
import type { PrecisePresenceDto, PresenceMemberDto } from "../../data/types";

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

/** Compact "now / 4m / 18m" age from seconds. Pass `t` to localise the "now" token. */
export function ago(seconds: number, t?: TranslateFn): string {
  if (seconds < 45) return t ? t("time.nowShort") : "now";
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  return `${hr}h`;
}

/** A platform maps "navigate to" deep link for an exact, consented coordinate (DEC-099). */
export function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
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

const COARSE_KEY = { at: "pline.at", near: "pline.near" } as const;

/**
 * Turn a member's presence into the honest one-liner the roster + map show. When `precise` is given
 * (the member shares an exact pin, DEC-099), the secondary clause becomes "exact · 2m ago" — the
 * truthful signal that this is a real coordinate, not a stage guess. The coarse "where" never
 * carries a coordinate.
 */
export function presenceLine(m: PresenceMemberDto, t: TranslateFn, precise?: PrecisePresenceDto): PresenceLine {
  if (m.shareMode === "ghost") {
    return { text: t("pline.notSharing"), sub: null, icon: "visibility_off", muted: true };
  }
  const p = m.presence;
  if (!p) {
    return {
      text: m.isYou ? t("pline.shareToAppear") : t("pline.noLocation"),
      sub: null,
      icon: "location_searching",
      muted: true,
    };
  }
  if (p.stale && !precise) {
    return { text: t("pline.lastSeen", { ago: ago(p.ageSeconds, t) }), sub: null, icon: "schedule", muted: true };
  }
  let where: string;
  if (p.coarseLabel === "between") {
    where = t("pline.between", { a: p.stageName ?? "—", b: p.betweenStageName ?? "—" });
  } else if (p.coarseLabel === "none" || !p.stageName) {
    where = t("pline.venue");
  } else {
    where = t(COARSE_KEY[p.coarseLabel as "at" | "near"] ?? "pline.near", { stage: p.stageName });
  }
  const sub = precise
    ? t("pline.exactAgo", { ago: ago(precise.ageSeconds, t) })
    : m.live
      ? t("pline.preciseLeft", { ago: ago(m.liveSecondsLeft ?? 0, t) })
      : p.currentArtistName
        ? t("pline.watching", { artist: p.currentArtistName })
        : null;
  return { text: where, sub, icon: m.live || precise ? "my_location" : "apartment", muted: false };
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

/** A coarse "place" the squad-home overview groups the live roster into (#23.7 redesign). */
export interface RosterPlace {
  key: string;
  /** Display label: a stage name, "A & B" for between, or a venue / off fallback. */
  label: string;
  kind: "stage" | "between" | "venue" | "off";
  /** Primary stage to colour the dot; null for the venue / off buckets. */
  stageName: string | null;
  hasYou: boolean;
  members: PresenceMemberDto[];
}

const PLACE_KIND_RANK: Record<RosterPlace["kind"], number> = { stage: 0, between: 1, venue: 2, off: 3 };

/** Classify one member into a coarse place. Ghost / no-fix / stale all fall to the muted "off" bucket. */
function placeOf(m: PresenceMemberDto): Pick<RosterPlace, "kind" | "key" | "label" | "stageName"> {
  const p = m.presence;
  if (m.shareMode === "ghost" || !p || p.stale) {
    return { kind: "off", key: "off", label: "Location off", stageName: null };
  }
  if (p.coarseLabel === "between") {
    const a = p.stageName ?? "—";
    const b = p.betweenStageName ?? "—";
    return { kind: "between", key: `between:${a}|${b}`, label: `${a} & ${b}`, stageName: p.stageName };
  }
  if (p.coarseLabel === "none" || !p.stageName) {
    return { kind: "venue", key: "venue", label: "In the venue", stageName: null };
  }
  return { kind: "stage", key: `stage:${p.stageName}`, label: p.stageName, stageName: p.stageName };
}

/**
 * Group the live roster by coarse place for the squad-home "Where is everyone" card — stages first
 * (busiest first), then between-pairs, a vague-venue bucket, and finally everyone whose location is
 * off. Pure + non-mutating so it's unit-tested; the card just renders dots + avatar clusters from it.
 */
export function groupRosterByStage(members: PresenceMemberDto[]): RosterPlace[] {
  const byKey = new Map<string, RosterPlace>();
  for (const m of members) {
    const place = placeOf(m);
    const existing = byKey.get(place.key);
    if (existing) {
      existing.members.push(m);
      existing.hasYou = existing.hasYou || m.isYou;
    } else {
      byKey.set(place.key, { ...place, hasYou: m.isYou, members: [m] });
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const k = PLACE_KIND_RANK[a.kind] - PLACE_KIND_RANK[b.kind];
    if (k !== 0) return k;
    if (a.members.length !== b.members.length) return b.members.length - a.members.length;
    return a.label.localeCompare(b.label);
  });
}
