/**
 * Join (#23.6 / B1.6). Two modes share one component:
 *   • no token in the path  → paste-a-link/code entry (the "Join with a link or QR" button), then
 *   • a token in the path   → the invite preview ("Andy invited you…") with Join / Not now.
 *
 * Guests are sent through the sign-in gate + profile first (DEC-039), carrying the join path as
 * `next` so they land back on the preview. Three honest entry paths converge on the same token
 * (E03/DEC-103): scan a friend's QR (camera, lazy jsQR), paste the invite link, or type the code.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api, ApiError } from "../../data/api";
import { initialsOf, useIdentity } from "../../data/identity";
import { readableInkOn } from "../../lib/contrast";
import { useT } from "../../i18n";
import type { InvitePreviewDto } from "../../data/types";
import { QrScanner } from "./QrScanner";

/**
 * Pull the invite code out of a pasted link, a scanned QR payload, or a raw code. A scanned QR may
 * encode a full URL with a query/hash (`/j/AB12CD?utm=x`), so we cut at the first `?`, `#`, or `/`
 * after the code before stripping separators — otherwise query chars would leak into the token.
 */
export function parseToken(raw: string): string {
  const trimmed = raw.trim();
  const afterJ = trimmed.includes("/j/") ? trimmed.split("/j/").pop()! : trimmed;
  const head = afterJ.split(/[?#/]/)[0];
  return head.replace(/[^0-9a-z]/gi, "").toUpperCase();
}

function JoinEntry(): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const [value, setValue] = useState("");
  const [scanning, setScanning] = useState(false);
  const token = parseToken(value);

  // Every entry path (scan / paste / type) normalises through parseToken, then lands on the preview.
  const goToToken = useCallback(
    (raw: string): void => {
      const parsed = parseToken(raw);
      if (parsed.length >= 4) navigate(`/squad/join/${parsed}`);
    },
    [navigate]
  );

  return (
    <>
      <StackHeader title={t("join.title")} backTo="/squad" />
      <div className="screen">
        <div style={{ padding: "2px 2px 4px" }}>
          <h1 className="poster" style={{ fontSize: 30, lineHeight: 1.05, margin: 0 }}>
            {t("join.title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10, lineHeight: 1.5 }}>
            {t("join.intro")}
          </p>
        </div>

        <button className="btn btn-primary join-scan-btn" onClick={() => setScanning(true)}>
          <span className="ms">qr_code_scanner</span>
          {t("join.scan")}
        </button>

        <span className="label">{t("join.label")}</span>
        <input
          id="invite-code"
          className="field"
          value={value}
          placeholder="AB12CD"
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
        />
        <p className="join-or-link">{t("join.orPasteLink")}</p>
      </div>
      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" disabled={token.length < 4} onClick={() => goToToken(value)}>
          <span className="ms">group_add</span>
          {t("common.continue")}
        </button>
      </div>
      {scanning && (
        <QrScanner
          onResult={(text) => {
            setScanning(false);
            goToToken(text);
          }}
          onClose={() => setScanning(false)}
        />
      )}
    </>
  );
}

function JoinPreview({ token }: { token: string }): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const [searchParams] = useSearchParams();
  // Set by onboarding when the user arrived via an invite link: join without a second tap.
  const autoJoin = searchParams.get("auto") === "1";
  const { user, hasProfile, ensure } = useIdentity();
  const [preview, setPreview] = useState<InvitePreviewDto | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const autoTried = useRef(false);

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

  const join = useCallback(async (): Promise<void> => {
    setJoining(true);
    setJoinError(null);
    try {
      const joined = await api.joinGroup(token);
      // Location step on join (DEC-097): ask to share location (coarse-visible default, opt-out) as
      // the first post-join step. The consent screen then continues the join flow (plan-share or
      // squad home) on accept OR skip — so location is asked once, in context, not buried in a menu.
      navigate(`/squad/${joined.id}/location?joined=1`, { replace: true });
    } catch (err) {
      setJoining(false);
      setJoinError(
        err instanceof ApiError && err.status === 409 ? t("join.full") : t("join.joinFailed")
      );
    }
  }, [token, navigate, t]);

  // Auto-join straight from an invite link (the user already opted in by opening it): once the preview
  // is ready and they have a profile, join once without waiting for a tap. Falls back to the manual
  // button if anything's off (no profile yet, already a member, error).
  useEffect(() => {
    if (autoJoin && hasProfile && status === "ready" && preview && !preview.alreadyMember && !autoTried.current) {
      autoTried.current = true;
      void join();
    }
  }, [autoJoin, hasProfile, status, preview, join]);

  // Guests must sign in + set a profile before joining (#23.6 caption). Carry the join path back.
  if (!hasProfile) {
    return <Navigate to={`/squad/signin?next=${encodeURIComponent(`/squad/join/${token}`)}`} replace />;
  }

  if (preview?.alreadyMember) return <Navigate to="/squad" replace />;

  const youName = user?.displayName ?? t("join.you");

  return (
    <>
      <StackHeader title={t("join.previewTitle")} backTo="/squad" />
      <div className="screen join-screen">
        {status === "loading" && <p className="squad-note">{t("join.loading")}</p>}
        {status === "notfound" && (
          <div className="glass info-note" style={{ marginTop: 8 }}>
            <span className="ms" style={{ color: "var(--danger)", fontSize: 18 }}>
              link_off
            </span>
            <div>{t("join.notFound")}</div>
          </div>
        )}
        {status === "error" && (
          <div className="glass info-note" style={{ marginTop: 8 }}>
            <span className="ms" style={{ color: "var(--danger)", fontSize: 18 }}>
              error
            </span>
            <div>{t("join.error")}</div>
          </div>
        )}

        {status === "ready" && preview && (
          <>
            <div style={{ textAlign: "center" }}>
              <span className="ava join-owner-ava" aria-hidden="true">
                {initialsOf(preview.ownerName)}
              </span>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
                <b style={{ color: "var(--ink)" }}>{preview.ownerName ?? t("join.someone")}</b>{" "}
                {t("join.invitedYou")}
              </p>
              <h1 className="poster" style={{ fontSize: 30, lineHeight: 1.05, margin: "4px 0 0" }}>
                {preview.name} {preview.emoji ?? ""}
              </h1>
            </div>

            <div className="glass join-count">
              <span className="label">
                {t(preview.memberCount === 1 ? "join.inSquadOne" : "join.inSquadMany", { count: preview.memberCount })}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{t("join.plusYou")}</span>
            </div>

            <div className="glass join-as">
              <span
                className="ava"
                style={{
                  width: 40,
                  height: 40,
                  fontSize: 13,
                  background: `linear-gradient(135deg, ${user?.avatarColor ?? "#F5A623"}, ${user?.avatarColor ?? "#FFD060"}cc)`,
                  color: readableInkOn(user?.avatarColor ?? "#F5A623"),
                }}
              >
                {initialsOf(youName)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{t("join.joinAs")}</div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{youName}</div>
              </div>
              <button
                className="chip"
                onClick={() =>
                  navigate(`/squad/profile?next=${encodeURIComponent(`/squad/join/${token}`)}`)
                }
              >
                {t("common.edit")}
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
          {joining ? t("join.joining") : t("join.joinCta")}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("/squad", { replace: true })}>
          {t("common.notNow")}
        </button>
      </div>
    </>
  );
}

export function JoinScreen(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  return token ? <JoinPreview token={token} /> : <JoinEntry />;
}
