/**
 * The single live region for unified toasts (Phase 10). Mounted once at the app root; it subscribes to
 * the imperative `toast` store and renders the current stack. A11y: each toast carries its own role —
 * `status` (polite) for info/success, `alert` (assertive) for errors — instead of nesting a live region,
 * so screen readers announce each toast once. Tap the × to dismiss early; otherwise it auto-dismisses.
 */
import { useSyncExternalStore } from "react";
import { getToasts, subscribeToasts, dismissToast } from "../lib/toast";

export function Toaster(): JSX.Element | null {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  if (toasts.length === 0) return null;
  return (
    <div className="toaster">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.tone} fp-rise`}
          role={toast.tone === "error" ? "alert" : "status"}
        >
          <span className="ms toast-ico" aria-hidden>
            {toast.icon}
          </span>
          <span className="toast-msg">{toast.message}</span>
          <button
            type="button"
            className="toast-x"
            aria-label="Dismiss"
            data-haptic="off"
            onClick={() => dismissToast(toast.id)}
          >
            <span className="ms" aria-hidden>
              close
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
