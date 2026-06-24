/**
 * Detect what changed in the lineup since the user last picked favorites (R4.3, DEC-048/052).
 *
 * Festivals are dynamic: new artists/days land after onboarding (e.g. a late "The Gathering" day),
 * and acts occasionally get pulled. We never silently drop a user's choice — instead we surface a
 * gentle "revisit your favorites" prompt. This is the pure diff behind that prompt:
 *   - addedActKeys      — acts present now that weren't there at the user's last acknowledgement
 *   - removedFavoriteKeys — the user's favorites that no longer map to any current act (pulled acts)
 * Both are computed from act keys only (DEC-026/028), so the prompt is stable across day re-scoping.
 */
export interface LineupChanges {
  addedActKeys: string[];
  removedFavoriteKeys: string[];
}

export interface LineupChangesInput {
  /** Unique act keys captured the last time the user reviewed the lineup (onboarding or a dismiss). */
  seenActKeys: readonly string[];
  /** Unique act keys in the lineup right now. */
  currentActKeys: readonly string[];
  /** The user's current favorites (act keys). */
  favoriteKeys: readonly string[];
}

export function lineupChangesSince(input: LineupChangesInput): LineupChanges {
  const seen = new Set(input.seenActKeys);
  const current = new Set(input.currentActKeys);

  const addedActKeys = input.currentActKeys.filter((key) => !seen.has(key));
  const removedFavoriteKeys = input.favoriteKeys.filter((key) => !current.has(key));

  return { addedActKeys, removedFavoriteKeys };
}

/** True when there's something worth prompting the user about (new acts or pulled favorites). */
export function hasLineupChanges(changes: LineupChanges): boolean {
  return changes.addedActKeys.length > 0 || changes.removedFavoriteKeys.length > 0;
}
