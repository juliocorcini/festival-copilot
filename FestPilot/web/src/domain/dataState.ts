/**
 * Festival data-state (DEC-052, review §2/§20). A festival moves through three honest states and the
 * UI must default to the right view for each — never a dead timetable, never hidden artists:
 *   - "nothing"     — announced but no acts yet            → both Timetable & Lineup show "no lineup yet"
 *   - "lineup_only" — acts announced, timetable not out    → default to Lineup; Timetable redirects to it
 *   - "timetable"   — schedule published                   → Timetable is primary, Lineup one tap away
 * Pure + framework-free so the routing decision is unit-tested without React.
 */
export type FestivalDataState = "nothing" | "lineup_only" | "timetable";

export function festivalDataState(hasLineup: boolean, hasTimetable: boolean): FestivalDataState {
  if (hasTimetable) return "timetable";
  if (hasLineup) return "lineup_only";
  return "nothing";
}

/** Whether the Timetable⇄Lineup switch is meaningful (only when both views have content). */
export function showsViewSwitch(state: FestivalDataState): boolean {
  return state === "timetable";
}
