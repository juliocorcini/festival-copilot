import { Suspense } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAdminAuth } from "./AdminGate";

interface NavSection {
  to: string;
  end?: boolean;
  icon: string;
  label: string;
}

// Only sections with a real screen are listed — no dead nav affordances (orchestrator §3).
const NAV: NavSection[] = [
  { to: "/admin", end: true, icon: "dashboard", label: "Festivals" },
  { to: "/admin/lineup", icon: "queue_music", label: "Lineup & timetable" },
  { to: "/admin/data-sources", icon: "database", label: "Data sources" },
  { to: "/admin/metrics", icon: "speed", label: "Metrics & runway" },
  { to: "/admin/suggestions", icon: "inbox", label: "Suggestions" },
  { to: "/admin/test-console", icon: "science", label: "Test console" },
];

/** Amber-Glass desktop shell for the admin back-office (R11.0; wireframe 30-amber-admin.html). */
export function AdminLayout(): JSX.Element {
  const { signOut } = useAdminAuth();
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand admin-side-brand">
          <div className="admin-brand-mark">
            <span className="ms">festival</span>
          </div>
          <div className="poster admin-brand-name">FestPilot</div>
          <span className="pill admin-brand-tag">admin</span>
        </div>
        <nav className="admin-nav">
          {NAV.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) => `admin-navi${isActive ? " on" : ""}`}
            >
              <span className="ms">{s.icon}</span>
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-side-foot">
          <button className="admin-navi" type="button" onClick={signOut}>
            <span className="ms">logout</span>
            Sign out
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Suspense fallback={<div className="admin-state">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
