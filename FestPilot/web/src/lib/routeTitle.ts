/**
 * Maps a pathname to a short, human screen name — used for the document title and the SPA route
 * announcer (a11y). Pure + data-driven (ordered rules, first match wins) so it is unit-tested and
 * trivial to extend. Unknown routes fall back to the app name, so the title is never empty.
 */
const APP_NAME = "FestPilot";

interface RouteRule {
  match: (path: string) => boolean;
  name: string;
}

const isExactly = (route: string) => (path: string): boolean => path === route;
const isUnder = (route: string) => (path: string): boolean =>
  path === route || path.startsWith(`${route}/`);

// Ordered most-specific → least. Squad sub-flows are matched by suffix before the generic /squad.
const RULES: RouteRule[] = [
  { match: isExactly("/"), name: "Now" },
  { match: isExactly("/timetable"), name: "Timetable" },
  { match: isExactly("/lineup"), name: "Lineup" },
  { match: isExactly("/plan"), name: "My Plan" },
  { match: isExactly("/map"), name: "Map" },
  { match: isExactly("/lockin"), name: "Lock in" },
  { match: isExactly("/route"), name: "Walking route" },
  { match: isExactly("/onboarding"), name: "Welcome" },
  { match: (p) => p.startsWith("/squad/") && /\/board$/.test(p), name: "Squad board" },
  { match: (p) => p.startsWith("/squad/") && /\/events$/.test(p), name: "Squad events" },
  { match: (p) => p.startsWith("/squad/") && /\/share$/.test(p), name: "Share plan" },
  { match: (p) => p.startsWith("/squad/") && /\/where$/.test(p), name: "Where's the squad" },
  { match: (p) => p.startsWith("/squad/") && /\/meet(\/|$)/.test(p), name: "Meeting point" },
  { match: (p) => p.startsWith("/squad/") && /\/safety$/.test(p), name: "Safety" },
  { match: (p) => p.startsWith("/squad/") && /\/plan(\/|$)/.test(p), name: "Squad plan" },
  { match: isUnder("/squad"), name: "Squad" },
  { match: isUnder("/settings"), name: "Settings" },
  { match: isUnder("/admin"), name: "Admin" },
];

/** The bare screen name (e.g. "Timetable"), for the aria-live announcer. */
export function routeName(pathname: string): string {
  const rule = RULES.find((r) => r.match(pathname));
  return rule ? rule.name : APP_NAME;
}

/** The document title (e.g. "Timetable · FestPilot"); just the app name for unknown routes. */
export function routeTitle(pathname: string): string {
  const name = routeName(pathname);
  return name === APP_NAME ? APP_NAME : `${name} · ${APP_NAME}`;
}
