import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useOnboarding } from "../data/localStore";

/**
 * Gate the main app behind first-run onboarding (#17). Skipping still marks it complete.
 * The attempted path is carried as `?next=` so deep links (notably a squad invite `/j/:token`)
 * survive the redirect and resume after onboarding instead of being dropped at home.
 */
export function RequireOnboarding(): JSX.Element {
  const { onboarding } = useOnboarding();
  const location = useLocation();
  if (!onboarding?.completed) {
    const attempted = location.pathname + location.search;
    const suffix = attempted && attempted !== "/" ? `?next=${encodeURIComponent(attempted)}` : "";
    return <Navigate to={`/onboarding${suffix}`} replace />;
  }
  return <Outlet />;
}
