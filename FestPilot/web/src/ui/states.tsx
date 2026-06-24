/** System states (screen-catalog B6.6): loading skeleton, error+retry, empty. Reused everywhere. */

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <div className="state error" role="alert">
      <span className="ms">error</span>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          <span className="ms">refresh</span> Try again
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
}

export function EmptyState({ icon = "inbox", title, message }: EmptyStateProps): JSX.Element {
  return (
    <div className="state">
      <span className="ms">{icon}</span>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
    </div>
  );
}

/** A few stacked shimmer bars — the generic "loading" skeleton. */
export function LoadingState({ rows = 4 }: { rows?: number }): JSX.Element {
  return (
    <div className="screen" aria-busy="true" aria-label="Loading">
      <div className="shimmer" style={{ height: 132 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="shimmer" style={{ height: 56 }} />
      ))}
    </div>
  );
}

interface ScreenSoonProps {
  icon: string;
  title: string;
  message: string;
}

/** Placeholder for screens delivered in a later phase (keeps nav navigable). */
export function ScreenSoon({ icon, title, message }: ScreenSoonProps): JSX.Element {
  return (
    <div className="soon">
      <span className="ms">{icon}</span>
      <h2 className="poster">{title}</h2>
      <p>{message}</p>
    </div>
  );
}
