import { Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { RouteFallback } from "./RouteFallback";

/** Shell for pushed/stack screens (settings, profile) — no bottom nav (DEC-032). */
export function StackLayout(): JSX.Element {
  // Re-key by route so each pushed screen fades in and starts at the top (see AppLayout note).
  const { pathname } = useLocation();
  return (
    <div className="app">
      <main className="scr route-fade" key={pathname}>
        <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
