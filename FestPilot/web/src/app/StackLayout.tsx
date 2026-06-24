import { Outlet } from "react-router-dom";

/** Shell for pushed/stack screens (settings, profile) — no bottom nav (DEC-032). */
export function StackLayout(): JSX.Element {
  return (
    <div className="app">
      <main className="scr">
        <Outlet />
      </main>
    </div>
  );
}
