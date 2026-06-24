import type { ReactNode } from "react";

/** Shared building blocks for the admin screens — one consistent header / state pattern. */

export function AdminHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}): JSX.Element {
  return (
    <div className="admin-head">
      <div>
        <div className="label">{eyebrow}</div>
        <h2 className="poster admin-title">{title}</h2>
      </div>
      {action ? <div className="admin-head-actions">{action}</div> : null}
    </div>
  );
}

export function AdminLoading(): JSX.Element {
  return (
    <div className="admin-state">
      <span className="ms admin-state-spin">progress_activity</span>
      <p>Loading…</p>
    </div>
  );
}

export function AdminErrorState({ message }: { message: string }): JSX.Element {
  return (
    <div className="admin-state">
      <span className="ms" style={{ color: "var(--danger-ink)" }}>
        error
      </span>
      <p>{message}</p>
    </div>
  );
}

export function AdminBanner({
  tone,
  icon,
  children,
}: {
  tone: "ok" | "warn" | "info";
  icon: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={`card admin-banner ${tone}`}>
      <span className="ms">{icon}</span>
      <div className="admin-banner-body">{children}</div>
    </div>
  );
}
