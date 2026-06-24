import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/** Shell for the 5 primary tabs: scrollable content + persistent bottom nav. */
export function AppLayout(): JSX.Element {
  return (
    <div className="app">
      <main className="scr">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
