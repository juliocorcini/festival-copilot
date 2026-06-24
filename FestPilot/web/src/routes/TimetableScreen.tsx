import { useNavigate } from "react-router-dom";
import { AppHeader } from "../app/AppHeader";
import { ScreenSoon } from "../ui/states";

export function TimetableScreen(): JSX.Element {
  const navigate = useNavigate();
  return (
    <>
      <AppHeader
        eyebrow="Schedule"
        title="Timetable"
        right={
          <button
            className="ava"
            style={{ background: "var(--glass)", border: "1px solid var(--border)" }}
            aria-label="Open Lineup"
            onClick={() => navigate("/lineup")}
          >
            <span className="ms" style={{ color: "var(--accent)" }}>groups</span>
          </button>
        }
      />
      <ScreenSoon
        icon="calendar_month"
        title="Timetable"
        message="The stage-by-stage grid lands next. For now, open the Lineup (top-right) to browse artists and build your favorites."
      />
    </>
  );
}
