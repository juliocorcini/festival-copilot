/**
 * Squad shared-timetable aggregation (Pillar 3a, Gate 4.3 — DEC-013/019/039).
 *
 * Pure and framework-free, like the personal resolver. The server stores each member's RAW shared
 * locked plan (+ favorites for the fallback) and the owner's pins; this function turns them into the
 * group timetable the same way for every client, against the lineup the client already holds.
 *
 * The contract (no voting, ever):
 *   1. Blocks are per set. A block winner is chosen by PLURALITY of locked picks.
 *   2. Ties break by how many members FAVORITED the act, then by the OWNER's pick / override.
 *   3. An owner OVERRIDE pins a set as the winner for its block (method = "owner").
 *   4. A member's locked must-see is NEVER silently changed — we only label their status
 *      (following / your own / conflict) and, on conflict, offer THEIR own favorite nearby.
 *   5. Splitting is shown, never fought: every non-winner pick a member locked is surfaced.
 */
import type { PlannableSet } from "./types";

export type BlockMethod = "plurality" | "favorited" | "owner";
export type YouStatus = "following" | "own" | "conflict" | "none";

export interface SquadMember {
  userId: string;
  displayName: string | null;
  avatarColor: string | null;
  role: string; // "owner" | "member"
  isYou: boolean;
  shared: boolean;
  /** Locked picks for the day (performance ids = setIds). */
  performanceIds: string[];
  /** Shared favorites (act keys); empty unless the member enabled the fallback. */
  favoriteActKeys: string[];
}

/** A non-winner set some members went to during a block (the squad "split"). */
export interface SplitGroup {
  set: PlannableSet;
  members: SquadMember[];
}

/** The current user's personal favorites-fallback when they're in conflict with the squad. */
export interface FallbackOffer {
  set: PlannableSet;
  /** Squad members (excluding you) also at that act this block. */
  friendsThere: number;
}

export interface SquadBlock {
  /** The winning set — the squad pick for this block. */
  set: PlannableSet;
  /** Members who locked the winner. */
  going: SquadMember[];
  goingCount: number;
  /** Distinct members doing their own overlapping thing this block. */
  splitCount: number;
  split: SplitGroup[];
  method: BlockMethod;
  /** The current user's relationship to this block. */
  youStatus: YouStatus;
  /** The set you locked that overlaps this block (drives the conflict copy). */
  yourLock: PlannableSet | null;
  /** Personal favorites-fallback offer (only when youStatus === "conflict"). */
  fallback: FallbackOffer | null;
  /** An owner override is pinning this set. */
  pinned: boolean;
}

export interface SquadPlan {
  blocks: SquadBlock[];
  memberCount: number;
  sharedCount: number;
  members: SquadMember[];
  /** The auto-plan produced at least one block (≥1 member shared a usable pick). */
  enoughToBuild: boolean;
}

export interface BuildSquadPlanInput {
  /** Plannable sets for the chosen day (from toPlannableSets, already day-filtered). */
  sets: PlannableSet[];
  members: SquadMember[];
  /** Owner-pinned setIds for the day. */
  overrides: string[];
  /** The current user's id, to compute youStatus / fallback. */
  meId: string | null;
  /** The current user's local favorite act keys, for the personal fallback (DEC-019). */
  myFavoriteActKeys?: ReadonlySet<string>;
}

function overlaps(a: PlannableSet, b: PlannableSet): boolean {
  return a.startMs < b.endMs && a.endMs > b.startMs;
}

/** Aggregate raw shared plans into the squad timetable. Deterministic and side-effect-free. */
export function buildSquadPlan(input: BuildSquadPlanInput): SquadPlan {
  const { sets, members, overrides, meId } = input;
  const myFavoriteActKeys = input.myFavoriteActKeys ?? new Set<string>();

  const setById = new Map(sets.map((s) => [s.id, s]));
  const pinned = new Set(overrides.filter((id) => setById.has(id)));
  const ownerId = members.find((m) => m.role === "owner")?.userId ?? null;

  // Who locked what + each member's locked sets (chronological).
  const pickedBy = new Map<string, SquadMember[]>();
  const lockedByMember = new Map<string, PlannableSet[]>();
  for (const m of members) {
    const locked: PlannableSet[] = [];
    for (const pid of m.performanceIds) {
      const set = setById.get(pid);
      if (!set) continue;
      locked.push(set);
      const arr = pickedBy.get(set.id) ?? [];
      arr.push(m);
      pickedBy.set(set.id, arr);
    }
    locked.sort((a, b) => a.startMs - b.startMs);
    lockedByMember.set(m.userId, locked);
  }

  const lockCount = (s: PlannableSet): number => pickedBy.get(s.id)?.length ?? 0;
  const favCount = (s: PlannableSet): number =>
    members.reduce((n, m) => (m.favoriteActKeys.includes(s.actKey) ? n + 1 : n), 0);
  const ownerLocked = (s: PlannableSet): boolean =>
    ownerId != null && (pickedBy.get(s.id)?.some((m) => m.userId === ownerId) ?? false);

  // Candidates = every set someone locked, plus owner pins. Rank by the contract, then select a
  // conflict-free sequence greedily (highest-priority winner first; skip anything it overlaps).
  const candidateIds = new Set<string>([...pickedBy.keys(), ...pinned]);
  const candidates = [...candidateIds]
    .map((id) => setById.get(id)!)
    .sort((a, b) => {
      const pin = (pinned.has(b.id) ? 1 : 0) - (pinned.has(a.id) ? 1 : 0);
      if (pin !== 0) return pin;
      if (lockCount(a) !== lockCount(b)) return lockCount(b) - lockCount(a);
      if (favCount(a) !== favCount(b)) return favCount(b) - favCount(a);
      const owner = (ownerLocked(b) ? 1 : 0) - (ownerLocked(a) ? 1 : 0);
      if (owner !== 0) return owner;
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      return a.id.localeCompare(b.id);
    });

  const winners: PlannableSet[] = [];
  for (const c of candidates) {
    if (winners.some((w) => overlaps(w, c))) continue;
    winners.push(c);
  }
  winners.sort((a, b) => a.startMs - b.startMs);

  const blocks = winners.map((winner) => buildBlock(winner));
  return {
    blocks,
    memberCount: members.length,
    sharedCount: members.filter((m) => m.shared).length,
    members,
    enoughToBuild: blocks.length > 0,
  };

  function methodFor(winner: PlannableSet): BlockMethod {
    if (pinned.has(winner.id)) return "owner";
    const competing = candidates.filter((c) => overlaps(c, winner));
    const maxLock = Math.max(...competing.map(lockCount));
    const leaders = competing.filter((c) => lockCount(c) === maxLock);
    if (leaders.length === 1) return "plurality";
    const maxFav = Math.max(...leaders.map(favCount));
    const favLeaders = leaders.filter((c) => favCount(c) === maxFav);
    if (maxFav > 0 && favLeaders.length === 1 && favLeaders[0]!.id === winner.id) return "favorited";
    return "owner";
  }

  function buildBlock(winner: PlannableSet): SquadBlock {
    const going = pickedBy.get(winner.id) ?? [];
    const goingIds = new Set(going.map((m) => m.userId));

    // The split: each non-winner member's overlapping locked set, grouped by set.
    const splitBySet = new Map<string, SquadMember[]>();
    const splitMembers = new Set<string>();
    for (const m of members) {
      if (goingIds.has(m.userId)) continue;
      const overlapping = (lockedByMember.get(m.userId) ?? []).find(
        (s) => s.id !== winner.id && overlaps(s, winner)
      );
      if (!overlapping) continue;
      const arr = splitBySet.get(overlapping.id) ?? [];
      arr.push(m);
      splitBySet.set(overlapping.id, arr);
      splitMembers.add(m.userId);
    }
    const split: SplitGroup[] = [...splitBySet.entries()]
      .map(([sid, ms]) => ({ set: setById.get(sid)!, members: ms }))
      .sort((a, b) => b.members.length - a.members.length || a.set.startMs - b.set.startMs);

    let youStatus: YouStatus = "none";
    let yourLock: PlannableSet | null = null;
    let fallback: FallbackOffer | null = null;
    if (meId) {
      yourLock = (lockedByMember.get(meId) ?? []).find((s) => overlaps(s, winner)) ?? null;
      if (yourLock && yourLock.id === winner.id) {
        youStatus = going.length > splitMembers.size ? "following" : "own";
      } else if (yourLock) {
        youStatus = "conflict";
        fallback = computeFallback(winner, yourLock);
      }
    }

    return {
      set: winner,
      going,
      goingCount: going.length,
      splitCount: splitMembers.size,
      split,
      method: methodFor(winner),
      youStatus,
      yourLock,
      fallback,
      pinned: pinned.has(winner.id),
    };
  }

  function computeFallback(winner: PlannableSet, yourLock: PlannableSet): FallbackOffer | null {
    if (myFavoriteActKeys.size === 0) return null;
    const excludeActs = new Set([winner.actKey, yourLock.actKey]);
    const options = sets
      .filter((s) => myFavoriteActKeys.has(s.actKey) && !excludeActs.has(s.actKey) && overlaps(s, winner))
      .map((s) => ({ set: s, friendsThere: (pickedBy.get(s.id) ?? []).filter((m) => m.userId !== meId).length }))
      .sort((a, b) => b.friendsThere - a.friendsThere || a.set.startMs - b.set.startMs);
    return options[0] ?? null;
  }
}
