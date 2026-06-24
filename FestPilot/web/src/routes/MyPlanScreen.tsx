import { AppHeader } from "../app/AppHeader";
import { ScreenSoon } from "../ui/states";

export function MyPlanScreen(): JSX.Element {
  return (
    <>
      <AppHeader eyebrow="Your day" title="My Plan" />
      <ScreenSoon
        icon="event_available"
        title="My Plan"
        message="Lock in your favorites and we build a clash-free timetable — coming in Phase 2."
      />
    </>
  );
}
