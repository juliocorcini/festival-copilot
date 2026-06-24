/**
 * Presence consent pre-prompt (#25.1) + OS dialog moment (#25.2 — the real browser permission).
 * Consent-at-point-of-use (DEC-006/015): a plain-language value + privacy promise BEFORE the OS
 * ask, so the real prompt isn't a cold request. "Turn on location" triggers the browser permission;
 * on grant we set this squad to coarse "stage" sharing, remember the opt-in, and open the roster.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useLocationSharing } from "../../data/presence";
import { setSharingOptIn } from "../../data/shareOptIn";

const PROMISES = [
  { icon: "apartment", color: "var(--ok)", title: "By default: just the stage", body: 'Squad sees "at MAINSTAGE", not a precise pin.' },
  { icon: "timer", color: "var(--accent)", title: "Precise is opt-in & temporary", body: "Share a live pin only when you choose — auto-off in 60 min." },
  { icon: "lock", color: "var(--accent)", title: "Squad only · never public", body: "Pause or go ghost anytime." },
];

export function PresenceConsentScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { group } = useGroup(id);
  const sharing = useLocationSharing();
  const [busy, setBusy] = useState(false);

  const turnOn = async (): Promise<void> => {
    if (!id || busy) return;
    setBusy(true);
    const ok = await sharing.enable(); // triggers the OS permission dialog (#25.2)
    if (ok) {
      try {
        await api.setShareMode(id, "stage");
      } catch {
        /* the fix already posted; mode defaults are fine */
      }
      setSharingOptIn(true);
      navigate(`/squad/${id}/where`);
    } else {
      setBusy(false);
    }
  };

  return (
    <>
      <StackHeader title={group ? `Sharing with ${group.name}` : "Share location"} backTo={id ? `/squad` : undefined} />
      <div className="screen presence-consent">
        <div className="consent-orb">
          <span className="ms">share_location</span>
        </div>
        <h2 className="poster consent-title">Never lose your people</h2>
        <p className="consent-lede">
          Turn on location to see where the squad is and let them find you. You're always in control.
        </p>

        <div className="consent-promises">
          {PROMISES.map((p) => (
            <div className="glass consent-promise" key={p.title}>
              <span className="ms" style={{ color: p.color }} aria-hidden="true">{p.icon}</span>
              <div>
                <div className="consent-promise-title">{p.title}</div>
                <div className="consent-promise-body">{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        {sharing.permission === "denied" && (
          <p className="consent-denied">
            Location is blocked for FestPilot. Enable it in your browser's site settings, then try again.
          </p>
        )}
        {sharing.error && sharing.permission !== "denied" && <p className="consent-denied">{sharing.error}</p>}
      </div>

      <div className="consent-actions">
        <button className="btn btn-primary" onClick={turnOn} disabled={busy || !sharing.supported}>
          <span className="ms" aria-hidden="true">my_location</span>
          {busy ? "Turning on…" : sharing.supported ? "Turn on location" : "Location unavailable"}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate("/squad")} disabled={busy}>
          Not now
        </button>
        <p className="consent-fineprint">Foreground only — we read your location while FestPilot is open.</p>
      </div>
    </>
  );
}
