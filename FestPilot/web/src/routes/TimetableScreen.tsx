import { AppHeader } from "../app/AppHeader";
import { ScreenSoon } from "../ui/states";

export function TimetableScreen(): JSX.Element {
  return (
    <>
      <AppHeader eyebrow="Schedule" title="Timetable" />
      <ScreenSoon
        icon="calendar_month"
        title="Timetable"
        message="The stage-by-stage grid lands in Phase 2 — favorites in gold, a live NOW line, and tap-to-heart."
      />
    </>
  );
}
