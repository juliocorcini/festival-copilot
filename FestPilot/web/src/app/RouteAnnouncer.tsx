import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { routeName, routeTitle } from "../lib/routeTitle";

/**
 * SPA-navigation a11y: keeps document.title in sync with the current screen (better history/tab
 * labels for everyone) and announces the screen name to assistive tech via a visually-hidden
 * aria-live region — React Router emits no such announcement on its own, so screen-reader users
 * otherwise get no signal that the screen changed on a tab switch.
 *
 * The first render only sets the title (the browser already announces the initial page load), so we
 * never double-announce on boot. Renders one off-screen <p>; nothing visible.
 */
export function RouteAnnouncer(): JSX.Element {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const isFirst = useRef(true);

  useEffect(() => {
    document.title = routeTitle(pathname);
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    setMessage(routeName(pathname));
  }, [pathname]);

  return (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
}
