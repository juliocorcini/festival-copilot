/**
 * Sign-in gate (#23.2 / B5.1, B1.2). DEC-024 anonymous-first; DEC-039 Google + email-link only
 * (no Apple). Firebase is deferred (DEC-038), so the working path in V1 is "continue as guest"
 * (an anonymous account that carries over when real accounts land). Google / email-link are shown
 * as upcoming so the screen matches the locked design without faking auth that doesn't exist yet.
 */
import { useNavigate, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useIdentity } from "../../data/identity";
import { ErrorState } from "../../ui/states";

export function SignInScreen(): JSX.Element {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/squad";
  const { ensure, loading, error } = useIdentity();

  const continueAsGuest = async (): Promise<void> => {
    const user = await ensure();
    if (!user) return;
    if (user.displayName) navigate(next, { replace: true });
    else navigate(`/squad/profile?next=${encodeURIComponent(next)}`, { replace: true });
  };

  return (
    <>
      <StackHeader title="Sign in" backTo="/squad" />
      <div className="screen">
        <div style={{ padding: "2px 2px 8px" }}>
          <h1 className="poster" style={{ fontSize: 30, lineHeight: 1.05, margin: 0 }}>
            Keep your squad
            <br />
            across devices
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12, lineHeight: 1.5 }}>
            Squads sync, so you sign in once. Your favorites and locked plan come with you — nothing
            is lost.
          </p>
        </div>

        {error && <ErrorState message="Could not reach the server. Check your connection and try again." />}

        <button className="btn btn-primary" onClick={continueAsGuest} disabled={loading}>
          <span className="ms">bolt</span>
          {loading ? "Setting up…" : "Continue as guest"}
        </button>

        <div className="signin-or">
          <span>or</span>
        </div>

        <button className="btn signin-google" disabled aria-disabled="true">
          <span className="ms">login</span>
          Continue with Google
          <span className="pill">Soon</span>
        </button>
        <button className="btn btn-ghost" disabled aria-disabled="true" style={{ marginTop: 10 }}>
          <span className="ms">mail</span>
          Email me a link
          <span className="pill">Soon</span>
        </button>

        <div className="glass" style={{ marginTop: 18, padding: 14, display: "flex", gap: 10 }}>
          <span className="ms" style={{ color: "var(--accent)", fontSize: 18 }}>
            info
          </span>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.45 }}>
            You're a <b style={{ color: "var(--ink)" }}>guest</b> right now — picks are saved on this
            phone. Google &amp; email sign-in arrive with accounts, and your guest squad carries over.
          </div>
        </div>
        <p className="squad-note">By continuing you accept the Terms &amp; Privacy.</p>
      </div>
    </>
  );
}
