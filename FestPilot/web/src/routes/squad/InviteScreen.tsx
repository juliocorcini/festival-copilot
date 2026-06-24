/**
 * Invite (#23.5 / B1.5). A scannable QR + the share link + native share / copy. The link never
 * expires until the festival ends (DEC-038). Token comes from the group (minted at create time).
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { StackHeader } from "../../app/StackHeader";
import { useGroup } from "../../data/groups";
import { LoadingState, ErrorState } from "../../ui/states";

function inviteLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://festpilot.app";
  return `${origin}/j/${token}`;
}

export function InviteScreen(): JSX.Element {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { group, status } = useGroup(id);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const token = group?.inviteToken ?? null;
  const link = useMemo(() => (token ? inviteLink(token) : ""), [token]);

  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toDataURL(link, {
      margin: 1,
      width: 320,
      color: { dark: "#100c06", light: "#FCF7EC" },
    })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(null));
    return () => {
      alive = false;
    };
  }, [link]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the link is visible to copy manually */
    }
  };

  const share = async (): Promise<void> => {
    const text = `Join my squad${group?.name ? ` "${group.name}"` : ""} on FestPilot`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "FestPilot squad", text, url: link });
      } catch {
        /* user dismissed the share sheet */
      }
    } else {
      void copy();
    }
  };

  if (status === "loading") return <LoadingState rows={3} />;
  if (status === "error" || !group || !token) {
    return (
      <>
        <StackHeader title="Invite" backTo="/squad" />
        <ErrorState message="Could not load the invite. Try again from the squad screen." />
      </>
    );
  }

  return (
    <>
      <StackHeader title="Invite" backTo="/squad" />
      <div className="screen invite-screen">
        <h1 className="poster" style={{ fontSize: 26, lineHeight: 1.1, textAlign: "center", margin: 0 }}>
          Bring the squad in
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", textAlign: "center", margin: "8px 0 4px" }}>
          Scan or share the link.{" "}
          <b style={{ color: "var(--ink)" }}>
            {group.emoji ? `${group.emoji} ` : ""}
            {group.name}
          </b>
        </p>

        <div className="glass invite-qr-card">
          {qr ? (
            <img className="invite-qr" src={qr} alt={`QR code to join ${group.name}`} width={172} height={172} />
          ) : (
            <div className="invite-qr shimmer" style={{ width: 172, height: 172 }} />
          )}
          <div className="invite-qr-hint">Point a camera here</div>
        </div>

        <div className="glass invite-link">
          <span className="ms" style={{ color: "var(--muted)", fontSize: 18 }}>
            link
          </span>
          <div className="invite-link-text">{link.replace(/^https?:\/\//, "")}</div>
          <button className="chip chip-accent" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={share}>
          <span className="ms">ios_share</span>
          Share invite
        </button>

        <div className="invite-expiry">
          <span className="ms" style={{ fontSize: 15 }}>
            schedule
          </span>
          Link works until the festival ends
        </div>
      </div>

      <div className="squad-actions" style={{ marginTop: "auto" }}>
        <button className="btn btn-primary" onClick={() => navigate("/squad", { replace: true })}>
          Done
        </button>
      </div>
    </>
  );
}
