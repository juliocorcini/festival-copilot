/**
 * Precise-sharing control (#25.5 — Gate 5.1). The always-visible control while a live pin is on:
 * a countdown ring to the server-hard 60-min auto-off (DEC-007/046), who-can-see-you avatars, and
 * extend / downgrade-to-coarse / stop. Honesty note (DEC-046): precise is a high-confidence, fast
 * coarse position now; the exact moving dot lands in Phase 6 on the meeting-point exact channel.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../data/api";
import { useGroup } from "../../data/groups";
import { useGroupPresence, useLocationSharing } from "../../data/presence";
import { setSharingOptIn } from "../../data/shareOptIn";
import type { ShareMode } from "../../data/types";
import { CoarsePresenceMap } from "./CoarsePresenceMap";
import { PresenceAvatar, mmss } from "./presenceUi";

const PRECISE_MINUTES = 60;
const PRECISE_SECONDS = PRECISE_MINUTES * 60;
const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;
const STACK_MAX = 4;

export function PreciseSharingScreen(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { group } = useGroup(id);
  const { presence, reload } = useGroupPresence(id);
  const sharing = useLocationSharing(reload);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);

  const me = presence?.me ?? null;
  const live = me?.live ?? false;

  // Seed/refresh the local countdown from server truth, then tick locally for a smooth ring.
  useEffect(() => {
    setSecs(me?.liveSecondsLeft ?? 0);
  }, [me?.liveSecondsLeft, me?.live]);
  useEffect(() => {
    if (!live) return;
    const i = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          reload();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(i);
  }, [live, reload]);

  // Keep the device sharing while this control is open (no prompt if already granted).
  useEffect(() => {
    if (sharing.supported && sharing.permission !== "denied" && !sharing.active) void sharing.enable();
  }, [sharing.supported, sharing.permission, sharing.active, sharing.enable]);

  const setMode = useCallback(
    async (mode: ShareMode, duration?: number): Promise<boolean> => {
      if (!id) return false;
      try {
        await api.setShareMode(id, mode, duration);
        reload();
        return true;
      } catch {
        return false;
      }
    },
    [id, reload]
  );

  const startOrExtend = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setSharingOptIn(true);
    if (sharing.supported && sharing.permission !== "denied" && !sharing.active) await sharing.enable();
    await setMode("precise", PRECISE_MINUTES);
    setSecs(PRECISE_SECONDS);
    setBusy(false);
  };

  const downgrade = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    await setMode("stage");
    navigate(`/squad/${id}/where`);
  };

  const stop = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    await setMode("ghost");
    navigate(`/squad/${id}/where`);
  };

  const others = useMemo(() => (presence?.members ?? []).filter((m) => !m.isYou), [presence]);
  const visible = others.slice(0, STACK_MAX);
  const overflow = others.length - visible.length;
  const dashOffset = RING_C * (1 - Math.min(1, Math.max(0, secs / PRECISE_SECONDS)));

  return (
    <div className="precise-screen">
      <div className="precise-map">
        <CoarsePresenceMap members={presence?.members ?? []} />
      </div>

      <button className="precise-back ava" aria-label="Back" onClick={() => navigate(`/squad/${id}/where`)}>
        <span className="ms">arrow_back</span>
      </button>

      <section className="precise-sheet glass">
        <div className="precise-grip" />
        <div className="precise-head">
          <div className="precise-ring">
            <svg width="56" height="56" viewBox="0 0 56 56" className="precise-ring-svg">
              <circle cx="28" cy="28" r={RING_R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="5" />
              {live && (
                <circle
                  cx="28"
                  cy="28"
                  r={RING_R}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={dashOffset}
                />
              )}
            </svg>
            <span className="ms precise-ring-icon" style={{ color: "var(--accent)" }}>my_location</span>
          </div>
          <div className="precise-head-text">
            <div className="precise-title">{live ? "Sharing precise location" : "Share a precise pin"}</div>
            <div className="precise-sub">
              {live ? (
                <>Auto-off in <b>{mmss(secs)}</b> · visible to {group?.name ?? "your squad"}</>
              ) : (
                <>A high-confidence live position · auto-off in {PRECISE_MINUTES} min</>
              )}
            </div>
          </div>
        </div>

        {others.length > 0 && (
          <div className="precise-stack">
            {visible.map((m) => (
              <PresenceAvatar key={m.userId} name={m.displayName} color={m.avatarColor} size={32} />
            ))}
            {overflow > 0 && <span className="precise-stack-more">+{overflow}</span>}
            <span className="precise-stack-label">can see you</span>
          </div>
        )}

        {live ? (
          <>
            <div className="precise-row">
              <button className="btn btn-ghost" onClick={startOrExtend} disabled={busy}>
                <span className="ms" aria-hidden="true">add</span>+{PRECISE_MINUTES} min
              </button>
              <button className="btn btn-ghost" onClick={downgrade} disabled={busy}>
                <span className="ms" aria-hidden="true">apartment</span>Coarse
              </button>
            </div>
            <button className="btn btn-danger" onClick={stop} disabled={busy}>
              <span className="ms" aria-hidden="true">location_off</span>Stop sharing now
            </button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={startOrExtend} disabled={busy || !sharing.supported}>
            <span className="ms" aria-hidden="true">my_location</span>
            {busy ? "Starting…" : `Share precise pin (${PRECISE_MINUTES} min)`}
          </button>
        )}
      </section>
    </div>
  );
}
