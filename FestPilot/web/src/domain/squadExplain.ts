/**
 * Plain-language transparency for a squad block (E08 · DEC-096). Turns the already-aggregated
 * `SquadBlock` into a structured explanation — WHO favorited the act, WHO locked it (going), the rule
 * that applied, and where the rest split — so the UI can compose human sentences (with names) in any
 * language via `t()`.
 *
 * INVARIANCE (ÂNCORA): this NEVER recomputes the winner. It only reads the block `buildSquadPlan`
 * already produced and derives the favoriting members from each member's `favoriteActKeys` against
 * the winning act key. Explaining ≠ re-aggregating — the winners stay identical to the baseline.
 */
import type { BlockMethod, SquadBlock, SquadMember } from "./squadPlan";

/** A non-winner pick some members went to, named for the explanation. */
export interface SplitExplain {
  label: string;
  stageName: string;
  /** Display names of the members at this split (null = a guest with no name yet). */
  names: (string | null)[];
}

export interface BlockExplanation {
  /** The rule that selected the winner. */
  method: BlockMethod;
  /** An owner override pinned this winner. */
  pinned: boolean;
  winnerLabel: string;
  stageName: string;
  /** Members who LOCKED the winner. */
  goingNames: (string | null)[];
  goingCount: number;
  /** Members who FAVORITED the winning act (derived, not re-aggregated). */
  favoritedNames: (string | null)[];
  favCount: number;
  memberCount: number;
  /** Where the rest of the squad went this block. */
  splits: SplitExplain[];
}

/** Build the structured "why this was chosen" explanation for a block. Pure, side-effect-free. */
export function explainSquadBlock(block: SquadBlock, members: SquadMember[]): BlockExplanation {
  const favoriters = members.filter((m) => m.favoriteActKeys.includes(block.set.actKey));
  return {
    method: block.method,
    pinned: block.pinned,
    winnerLabel: block.set.label,
    stageName: block.set.stageName,
    goingNames: block.going.map((m) => m.displayName),
    goingCount: block.goingCount,
    favoritedNames: favoriters.map((m) => m.displayName),
    favCount: favoriters.length,
    memberCount: members.length,
    splits: block.split.map((g) => ({
      label: g.set.label,
      stageName: g.set.stageName,
      names: g.members.map((m) => m.displayName),
    })),
  };
}
