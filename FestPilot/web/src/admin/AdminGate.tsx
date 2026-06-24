import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminError, clearAdminToken, getAdminToken, pingAdmin, setAdminToken } from "./adminApi";

interface AdminAuth {
  signOut: () => void;
}
const AdminAuthContext = createContext<AdminAuth>({ signOut: () => {} });
export const useAdminAuth = (): AdminAuth => useContext(AdminAuthContext);

type Phase = "checking" | "locked" | "authed";

/**
 * Guards the whole admin route group (R11.0). Validates the stored x-admin-token against the
 * server /ping probe; an absent/invalid token shows the unlock form. Non-admins never see the shell.
 */
export function AdminGate(): JSX.Element {
  const [phase, setPhase] = useState<Phase>(getAdminToken() ? "checking" : "locked");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    if (phase === "checking") {
      pingAdmin()
        .then((ok) => mounted.current && setPhase(ok ? "authed" : "locked"))
        .catch(() => mounted.current && setPhase("locked"));
    }
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function unlock(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const token = value.trim();
    if (!token) return;
    setBusy(true);
    setError(null);
    setAdminToken(token);
    try {
      const ok = await pingAdmin();
      if (ok) {
        setPhase("authed");
        setValue("");
      } else {
        clearAdminToken();
        setError("That token was rejected.");
      }
    } catch (err) {
      const msg = err instanceof AdminError && err.status === 0 ? "Can't reach the admin API." : "Something went wrong.";
      setError(msg);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function signOut(): void {
    clearAdminToken();
    setPhase("locked");
  }

  if (phase === "authed") {
    return (
      <AdminAuthContext.Provider value={{ signOut }}>
        <Outlet />
      </AdminAuthContext.Provider>
    );
  }

  return (
    <div className="admin-lock">
      <form className="admin-lock-card card" onSubmit={unlock}>
        <div className="admin-brand">
          <div className="admin-brand-mark">
            <span className="ms">festival</span>
          </div>
          <div className="poster admin-brand-name">FestPilot</div>
          <span className="pill admin-brand-tag">admin</span>
        </div>
        {phase === "checking" ? (
          <p className="admin-lock-hint">Checking your access…</p>
        ) : (
          <>
            <p className="admin-lock-hint">Enter the operator token to open the back-office.</p>
            <label className="label" htmlFor="admin-token">
              Admin token
            </label>
            <input
              id="admin-token"
              className="field selectable"
              type="password"
              autoComplete="off"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="x-admin-token"
            />
            {error ? <p className="admin-lock-error">{error}</p> : null}
            <button className="btn btn-primary admin-lock-btn" type="submit" disabled={busy || !value.trim()}>
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
