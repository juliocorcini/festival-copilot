/**
 * Join (#23.6 / B1.6). Two modes share one component:
 *   • no token in the path  → paste-a-link/code entry (the "Join with a link or QR" button), then
 *   • a token in the path   → the invite preview ("Andy invited you…") with Join / Not now.
 *
 * Guests are sent through the sign-in gate + profile first (DEC-039), carrying the join path as
 * `next` so they land back on the preview. QR *scanning* (camera) is a later add; the link is the
 * primary path and pasting a code covers the manual case.
 */
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { autoShareOnJoinEnabled } from "../../app/settings";
import { api, ApiError } from "../../data/api";
import { initialsOf, useIdentity } from "../../data/identity";
import type { InvitePreviewDto } from "../../data/types";

/** Pull the invite code out of a pasted link or raw code. */
function parseToken(raw: string): string {
  const trimmed = raw.trim();
  const afterJ = trimmed.includes("/j/") ? trimmed.split("/j/").pop()! : trimmed;
  return afterJ.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

function JoinEntry(): JSX.Element {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const token = parseToken(value);
  return (
    <>
      <StackHeader title="Join a squad" backTo="/squad" />
      <div className="screen">
        <div style={{ padding: "2px 2px 4px" }}>
          <h1 className="poster" style={{ fontSize: 30, lineHeight: 1.05, margin: 0 }}>
            Join a squad
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
            Paste the invite link a friend sent you, or type the code from their screen.
          </p>
        </div>
        <span className="label">Invite link or code</span>
        <input
          id="invite-code"
          className="field"
          value={value}
          placeholder="festpilot.app/j/AB12CD"
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
      </div>
      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button
          className="btn btn-primary"
          disabled={token.length < 4}
          onClick={() => navigate(`/squad/join/${token}`)}
        >
          <span className="ms">group_add</span>
          Continue
        </button>
      </div>
    </>
  );
}

function JoinPreview({ token }: { token: string }): JSX.Element {
  const navigate = useNavigate();
  const { user, hasProfile, ensure } = useIdentity();
  const [preview, setPreview] = useState<InvitePreviewDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) void ensure();
  }, [user, ensure]);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setStatus("loading");
    api
      .getInvite(token, controller.signal)
      .then((p) => {
        if (!alive) return;
        setPreview(p);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive || controller.signal.aborted) return;
        setStatus(err instanceof ApiError && err.status === 404 ? "notfound" : "error");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [token]);

  // Guests must sign in + set a profile before joining (#23.6 caption). Carry the join path back.
  if (!hasProfile) {
    return <Navigate to={`/squad/signin?next=${encodeURIComponent(`/squad/join/${token}`)}`} replace />;
  }

  if (preview?.alreadyMember) return <Navigate to="/squad" replace />;

  const join = async (): Promise<void> => {
    setJoining(true);
    setJoinError(null);
    try {
      const joined = await api.joinGroup(token);
      // Auto-share on join (DEC-054): land on the share confirm (toggles default ON) unless the user
      // opted out in Settings, in which case go straight to the squad home.
      navigate(autoShareOnJoinEnabled() ? `/squad/${joined.id}/share?joined=1` : "/squad", { replace: true });
    } catch (err) {
      setJoining(false);
      setJoinError(
        err instanceof ApiError && err.status === 409
          ? "This squad is full (50 people)."
          : "Could not join. Check your connection and try again."
      );
    }
  };

  const youName = user?.displayName ?? "you";

  return (
    <>
      <StackHeader title="Join squad" backTo="/squad" />
      <div className="screen join-screen">
        {status === "loading" && <p className="squad-note">Loading invite…</p>}
        {status === "notfound" && (
          <div className="glass info-note" style={{ marginTop: 8 }}>
            <span className="ms" style={{ color: "var(--danger)", fontSize: 18 }}>
              link_off
            </span>
            <div>That invite link isn't valid. Ask your friend to send it again.</div>
          </div>
        )}
        {status === "error" && (
          <div className="glass info-note" style={{ marginTop: 8 }}>
            <span className="ms" style={{ color: "var(--danger)", fontSize: 18 }}>
              error
            </span>
            <div>Could not reach the server. Check your connection and try again.</div>
          </div>
        )}

        {status === "ready" && preview && (
          <>
            <div style={{ textAlign: "center" }}>
              <span className="ava join-owner-ava" aria-hidden="true">
                {initialsOf(preview.ownerName)}
              </span>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
                <b style={{ color: "var(--ink)" }}>{preview.ownerName ?? "Someone"}</b> invited you to
                join
              </p>
              <h1 className="poster" style={{ fontSize: 30, lineHeight: 1.05, margin: "4px 0 0" }}>
                {preview.name} {preview.emoji ?? ""}
              </h1>
            </div>

            <div className="glass join-count">
              <span className="label">
                {preview.memberCount} {preview.memberCount === 1 ? "person" : "people"} in the squad
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>+ you</span>
            </div>

            <div className="glass join-as">
              <span
                className="ava"
                style={{
                  width: 40,
                  height: 40,
                  fontSize: 13,
                  background: `linear-gradient(135deg, ${user?.avatarColor ?? "#F5A623"}, ${user?.avatarColor ?? "#FFD060"}cc)`,
                  color: "#0F0D09",
                }}
              >
                {initialsOf(youName)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>You'll join as</div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{youName}</div>
              </div>
              <button
                className="chip"
                onClick={() =>
                  navigate(`/squad/profile?next=${encodeURIComponent(`/squad/join/${token}`)}`)
                }
              >
                Edit
              </button>
            </div>

            {joinError && (
              <p className="squad-note" style={{ color: "var(--danger)" }}>
                {joinError}
              </p>
            )}
          </>
        )}
      </div>

      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button
          className="btn btn-primary"
          disabled={status !== "ready" || joining}
          onClick={join}
        >
          <span className="ms">group_add</span>
          {joining ? "Joining…" : "Join squad"}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("/squad", { replace: true })}>
          Not now
        </button>
      </div>
    </>
  );
}

export function JoinScreen(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  return token ? <JoinPreview token={token} /> : <JoinEntry />;
}
