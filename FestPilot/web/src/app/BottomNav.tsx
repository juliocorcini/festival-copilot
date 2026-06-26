import { type CSSProperties } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useT, type MessageKey } from "../i18n";

// Exactly 5 tabs (DEC-032). Lineup is NOT a tab (it's a header icon on Timetable).
const TABS: { to: string; end: boolean; icon: string; label: MessageKey }[] = [
  { to: "/", end: true, icon: "bolt", label: "nav.now" },
  { to: "/timetable", end: false, icon: "calendar_month", label: "nav.timetable" },
  { to: "/plan", end: false, icon: "event_available", label: "nav.myPlan" },
  { to: "/map", end: false, icon: "map", label: "nav.map" },
  { to: "/squad", end: false, icon: "group", label: "nav.squad" },
];

/** Which tab the current path belongs to — drives the sliding indicator (D5 part 2). */
function activeIndex(pathname: string): number {
  if (pathname === "/") return 0;
  const i = TABS.findIndex((tab) => tab.to !== "/" && pathname.startsWith(tab.to));
  return i; // -1 on non-tab paths → indicator hidden
}

export function BottomNav(): JSX.Element {
  const t = useT();
  const { pathname } = useLocation();
  const active = activeIndex(pathname);
  return (
    <nav className="nav" aria-label="Primary">
      <span
        className="nav-ind"
        aria-hidden="true"
        style={{ "--active": active, opacity: active < 0 ? 0 : 1 } as CSSProperties}
      />
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => (isActive ? "navitem active" : "navitem")}
        >
          <span className="ms">{tab.icon}</span>
          {t(tab.label)}
        </NavLink>
      ))}
    </nav>
  );
}
