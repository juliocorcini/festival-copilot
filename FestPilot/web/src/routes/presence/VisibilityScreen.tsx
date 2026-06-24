/**
 * Sharing-mode picker (#25.3 — Gate 5.3). Per-squad visibility: Stage labels (default) / Precise
 * (60-min auto-off) / Ghost. Scope is one squad — "visible to <group> only" (DEC-015). Honesty note
 * (DEC-046): precise is a high-confidence coarse position + countdown; the exact dot lands Phase 6.
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useGroupPresence, useLocationSharing } from "../../data/presence";
import { getPreciseMinutes, setSharingOptIn } from "../../data/shareOptIn";
import type { ShareMode } from "../../data/types";
import { LoadingState } from "../../ui/states";

interface ModeOption {
  mode: ShareMode;
  icon: string;
  color: string;
  title: string;
  body: (minutes: number) => string;
  badge?: string;
}

const OPTIONS: ModeOption[] = [
  { mode: "stage", icon: "apartment", color: "var(--ok)", title: "Stage labels", badge: "Default", body: () => 'Squad sees "at MAINSTAGE" — not a precise pin.' },
  { mode: "precise", icon: "my_location", color: "var(--accent)", title: "Precise live pin", body: (m) => `A live, high-confidence position. Auto-off after ${m} min.` },
  { mode: "ghost", icon: "visibility_off", color: "var(--muted)", title: "Ghost mode", body: () => "You see them, they don't see you." },
];

export function VisibilityScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { group } = useGroup(id);
  const { presence, status, reload } = useGroupPresence(id);
  const sharing = useLocationSharing();
  const minutes = getPreciseMinutes();
  const [selected, setSelected] = useState<ShareMode | null>(null);
  const [busy, setBusy] = useState(false);

  const current = selected ?? presence?.me.shareMode ?? "stage";

  const save = async (): Promise<void> => {
    if (!id || busy) return;
    setBusy(true);
    if (current === "precise") {
      setSharingOptIn(true);
      if (sharing.supported && sharing.permission !== "denied" && !sharing.active) await sharing.enable();
    }
    try {
      await api.setShareMode(id, current, current === "precise" ? minutes : undefined);
      reload();
    } catch {
      /* keep the user on the screen if the network blips */
    }
    navigate(`/squad/${id}/where`);
  };

  if (status === "loading" && !presence) return <LoadingState rows={3} />;

  return (
    <>
      <StackHeader title="How you appear" backTo={`/squad/${id}/where`} />
      <div className="screen visibility-screen">
        <div className="label">Sharing with {group?.name ?? "your squad"}</div>

        {OPTIONS.map((o) => {
          const on = current === o.mode;
          return (
            <button key={o.mode} className={`glass visibility-card${on ? " on" : ""}`} onClick={() => setSelected(o.mode)}>
              <span className="ms" style={{ color: o.color }} aria-hidden="true">{o.icon}</span>
              <div className="visibility-main">
                <div className="visibility-title">
                  {o.title}
                  {o.badge && <span className="pill pill-default">{o.badge}</span>}
                </div>
                <div className="visibility-body">{o.body(minutes)}</div>
              </div>
              <span className="ms" style={{ color: on ? "var(--accent)" : "var(--muted)" }} aria-hidden="true">
                {on ? "radio_button_checked" : "radio_button_unchecked"}
              </span>
            </button>
          );
        })}

        <div className="visibility-note">
          <span className="ms" aria-hidden="true">verified_user</span>
          <span>Visible to <b>{group?.name ?? "this squad"} only</b>. Change this per squad, anytime.</span>
        </div>
      </div>

      <div className="where-actions">
        <button className="btn btn-primary" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}
