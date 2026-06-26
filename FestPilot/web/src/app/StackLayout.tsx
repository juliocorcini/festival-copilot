import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { RouteFallback } from "./RouteFallback";

/** Shell for pushed/stack screens (settings, profile) — no bottom nav (DEC-032). */
export function StackLayout(): JSX.Element {
  // Re-key by route so each pushed screen fades in and starts at the top (see AppLayout note).
  const { pathname } = useLocation();
  return (
    <div className="app">
      <main className="scr route-fade" key={pathname}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
