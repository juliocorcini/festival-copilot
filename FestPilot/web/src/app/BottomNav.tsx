import { NavLink } from "react-router-dom";

// Exactly 5 tabs (DEC-032). Lineup is NOT a tab (it's a header icon on Timetable).
const TABS = [
  { to: "/", end: true, icon: "bolt", label: "Now" },
  { to: "/timetable", end: false, icon: "calendar_month", label: "Timetable" },
  { to: "/plan", end: false, icon: "event_available", label: "My Plan" },
  { to: "/map", end: false, icon: "map", label: "Map" },
  { to: "/squad", end: false, icon: "group", label: "Squad" },
] as const;

export function BottomNav(): JSX.Element {
  return (
    <nav className="nav" aria-label="Primary">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => (isActive ? "navitem active" : "navitem")}
        >
          <span className="ms">{tab.icon}</span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
