/**
 * Revisit-favorites prompt (R4.3, DEC-048/052). Festivals are dynamic — artists and whole days land
 * after onboarding, and acts occasionally get pulled. Rather than silently changing the user's data,
 * we surface a gentle, dismissible nudge to take another look. Shown on the Timetable and Lineup.
 *
 * Only appears once there's a baseline (captured at onboarding) AND the lineup has actually changed.
 * "Review" opens the Lineup and acknowledges; "Dismiss" just acknowledges — both clear it until the
 * next real change.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useFavorites, useOnboarding } from "../data/localStore";
import { useLineup } from "../data/useLineup";
import { uniqueActs } from "../domain/lineup";
import { hasLineupChanges, lineupChangesSince } from "../domain/lineupDiff";

export function LineupUpdateBanner(): JSX.Element | null {
  const { lineup } = useLineup();
  const { onboarding, acknowledgeLineup } = useOnboarding();
  const navigate = useNavigate();
  const favorites = useFavorites(lineup?.festival.id);

  const currentActKeys = useMemo(
    () => (lineup ? uniqueActs(lineup.performances).map((a) => a.actKey) : []),
    [lineup]
  );

  const seen = onboarding?.seenActKeys;
  // No baseline (skipped/legacy onboarding) or no data yet → never prompt.
  if (!lineup || !seen) return null;

  const changes = lineupChangesSince({
    seenActKeys: seen,
    currentActKeys,
    favoriteKeys: [...favorites.keys],
  });
  if (!hasLineupChanges(changes)) return null;

  const parts: string[] = [];
  if (changes.addedActKeys.length > 0) {
    const n = changes.addedActKeys.length;
    parts.push(`${n} new ${n === 1 ? "artist" : "artists"} added`);
  }
  if (changes.removedFavoriteKeys.length > 0) {
    const n = changes.removedFavoriteKeys.length;
    parts.push(`${n} of your picks ${n === 1 ? "is" : "are"} no longer playing`);
  }

  const review = (): void => {
    acknowledgeLineup(currentActKeys);
    navigate("/lineup");
  };
  const dismiss = (): void => acknowledgeLineup(currentActKeys);

  return (
    <div className="lineup-update" role="status">
      <span className="ms" aria-hidden="true">campaign</span>
      <div className="lu-text">
        <div className="lu-title">Lineup updated</div>
        <div className="lu-sub">{parts.join(" · ")} — take another look at your favorites.</div>
      </div>
      <div className="lu-actions">
        <button className="lu-review" type="button" onClick={review}>Review</button>
        <button className="lu-dismiss" type="button" aria-label="Dismiss update" onClick={dismiss}>
          <span className="ms" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  );
}
