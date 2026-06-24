import { AppHeader } from "../app/AppHeader";
import { ScreenSoon } from "../ui/states";

export function SquadScreen(): JSX.Element {
  return (
    <>
      <AppHeader eyebrow="Together" title="Squad" />
      <ScreenSoon
        icon="group"
        title="Squad"
        message="Create a group, share a timetable, and find each other on the map — coming in Phase 4."
      />
    </>
  );
}
