import { Navigate, Outlet } from "react-router-dom";
import { useOnboarding } from "../data/localStore";

/** Gate the main app behind first-run onboarding (#17). Skipping still marks it complete. */
export function RequireOnboarding(): JSX.Element {
  const { onboarding } = useOnboarding();
  if (!onboarding?.completed) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
