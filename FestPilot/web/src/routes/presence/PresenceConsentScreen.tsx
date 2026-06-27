/**
 * Presence consent (#25.1/#25.2) — also the location step of the squad join flow (DEC-097, Leva 2
 * G5). Consent-at-point-of-use (DEC-006/015): a plain-language value + privacy promise BEFORE the OS
 * ask, so the real prompt isn't a cold request. The default stance is "share coarse" (stage-level)
 * with a clear opt-out — "Turn on location" grants the OS permission and sets this squad to coarse
 * "stage"; precise stays opt-in (DEC-099). When reached from join (`?joined=1`), accepting or
 * skipping both continue the join flow (plan-share or squad home) rather than bouncing to the roster.
 */
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { autoShareOnJoinEnabled } from "../../app/settings";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useLocationSharing } from "../../data/presence";
import { getDefaultShareMode, getPreciseMinutes, setSharingOptIn } from "../../data/shareOptIn";
import { useT } from "../../i18n";

export function PresenceConsentScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const { group } = useGroup(id);
  const sharing = useLocationSharing();
  const [busy, setBusy] = useState(false);

  const joined = searchParams.get("joined") === "1";

  // After consenting/skipping: from join, continue the join flow (plan-share or squad); otherwise
  // open the roster the user came from.
  const onward = (): string => {
    if (!id) return "/squad";
    if (joined) return autoShareOnJoinEnabled() ? `/squad/${id}/share?joined=1` : "/squad";
    return `/squad/${id}/where`;
  };

  const promises = [
    { icon: "apartment", color: "var(--ok)", title: t("consent.promiseStageTitle"), body: t("consent.promiseStageBody") },
    { icon: "timer", color: "var(--accent)", title: t("consent.promisePreciseTitle"), body: t("consent.promisePreciseBody") },
    { icon: "lock", color: "var(--accent)", title: t("consent.promiseSquadTitle"), body: t("consent.promiseSquadBody") },
  ];

  const turnOn = async (): Promise<void> => {
    if (!id || busy) return;
    setBusy(true);
    const ok = await sharing.enable(); // triggers the OS permission dialog (#25.2)
    if (ok) {
      // Apply the user's default visibility — but turning sharing ON never starts as ghost.
      const mode = getDefaultShareMode() === "ghost" ? "stage" : getDefaultShareMode();
      try {
        await api.setShareMode(id, mode, mode === "precise" ? getPreciseMinutes() : undefined);
      } catch {
        /* the fix already posted; server defaults are fine */
      }
      setSharingOptIn(true);
      navigate(onward());
    } else {
      setBusy(false);
    }
  };

  const squadName = group?.name ?? null;
  const title = joined && squadName ? t("consent.joinTitle", { squad: squadName }) : squadName ? t("consent.titleWith", { squad: squadName }) : t("consent.title");

  return (
    <>
      <StackHeader title={title} backTo={id ? `/squad` : undefined} />
      <div className="screen presence-consent">
        <div className="consent-orb">
          <span className="ms">share_location</span>
        </div>
        <h2 className="poster consent-title">{t("consent.heading")}</h2>
        <p className="consent-lede">{t("consent.lede")}</p>

        <div className="consent-promises">
          {promises.map((p) => (
            <div className="glass consent-promise" key={p.title}>
              <span className="ms" style={{ color: p.color }} aria-hidden="true">{p.icon}</span>
              <div>
                <div className="consent-promise-title">{p.title}</div>
                <div className="consent-promise-body">{p.body}</div>
              </div>
            </div>
          ))}
        </div>

        {sharing.permission === "denied" && <p className="consent-denied">{t("consent.denied")}</p>}
        {sharing.error && sharing.permission !== "denied" && <p className="consent-denied">{sharing.error}</p>}
      </div>

      <div className="consent-actions">
        <button className="btn btn-primary" onClick={turnOn} disabled={busy || !sharing.supported}>
          <span className="ms" aria-hidden="true">my_location</span>
          {busy ? t("consent.turningOn") : sharing.supported ? t("consent.turnOn") : t("consent.unavailable")}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate(onward())} disabled={busy}>
          {joined ? t("consent.skip") : t("consent.notNow")}
        </button>
        <p className="consent-fineprint">{t("consent.fineprint")}</p>
      </div>
    </>
  );
}
