/**
 * Suspense fallback for code-split routes. Lazily-loaded clusters (map, squad, presence, meet,
 * settings, lock-in) resolve their chunk before painting; this fills the screen height so the
 * route-fade never collapses (no layout shift) and shows a discreet branded spinner. The spin is
 * neutralised by the global `prefers-reduced-motion` safeguard in styles.css.
 */
export function RouteFallback(): JSX.Element {
  return (
    <div className="route-fallback" role="status" aria-label="Loading">
      <span className="route-fallback-spin ms" aria-hidden>
        progress_activity
      </span>
    </div>
  );
}
