/** System states (screen-catalog B6.6): loading skeleton, error+retry, empty. Reused everywhere. */
import { useT } from "../i18n";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title, message, onRetry }: ErrorStateProps): JSX.Element {
  const t = useT();
  return (
    <div className="state error" role="alert">
      <span className="ms">error</span>
      <h2>{title ?? t("common.somethingWrong")}</h2>
      {message && <p>{message}</p>}
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          <span className="ms">refresh</span> {t("common.tryAgain")}
        </button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  /** Optional call-to-action so an empty state can also be a way forward (no dead ends). */
  action?: { label: string; icon?: string; onClick: () => void };
}

export function EmptyState({ icon = "inbox", title, message, action }: EmptyStateProps): JSX.Element {
  return (
    <div className="state">
      <span className="ms">{icon}</span>
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      {action && (
        <button className="btn btn-primary" onClick={action.onClick}>
          {action.icon && <span className="ms">{action.icon}</span>} {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * The generic "loading" skeleton: a hero block + either stacked bars (`list`, default) or a card
 * grid (`grid`, for the Lineup) so the placeholder roughly matches the screen it stands in for.
 */
export function LoadingState({
  rows = 4,
  variant = "list",
}: {
  rows?: number;
  variant?: "list" | "grid";
}): JSX.Element {
  const t = useT();
  return (
    <div className="screen" aria-busy="true" aria-label={t("common.loading")}>
      <div className="shimmer" style={{ height: 132 }} />
      {variant === "grid" ? (
        <div className="shimmer-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer shimmer-card" />
          ))}
        </div>
      ) : (
        Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: 56 }} />
        ))
      )}
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
