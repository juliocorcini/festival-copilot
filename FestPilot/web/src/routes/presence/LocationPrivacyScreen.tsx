/**
 * Location & privacy settings (#25.6 — Gate 5.3, DEC-006/015). Device-global controls:
 *   - master switch (foreground sharing engine on/off),
 *   - default visibility mode applied to new shares,
 *   - precise auto-expiry stepper,
 *   - audience (squad-only; informational),
 *   - "pause all sharing" — go invisible across every squad at once (server-side).
 * Plain privacy promise: never public, never sold, foreground only.
 */
import { useState } from "react";
import { StackHeader } from "../../app/StackHeader";
import { api } from "../../data/api";
import {
  PRECISE_MAX,
  PRECISE_MIN,
  PRECISE_STEP,
  setDefaultShareMode,
  setPreciseMinutes,
  setSharingOptIn,
  useDefaultShareMode,
  usePreciseMinutes,
  useSharingOptIn,
} from "../../data/shareOptIn";
import type { ShareMode } from "../../data/types";

const MODES: { mode: ShareMode; label: string }[] = [
  { mode: "stage", label: "Stage" },
  { mode: "precise", label: "Precise" },
  { mode: "ghost", label: "Ghost" },
];

export function LocationPrivacyScreen(): JSX.Element {
  const optedIn = useSharingOptIn();
  const defaultMode = useDefaultShareMode();
  const minutes = usePreciseMinutes();
  const [paused, setPaused] = useState(false);
  const [pausing, setPausing] = useState(false);

  const togglePauseAll = async (): Promise<void> => {
    if (pausing) return;
    const next = !paused;
    setPausing(true);
    setPaused(next);
    try {
      await api.pauseSharing(next);
    } catch {
      setPaused(!next); // revert on failure
    } finally {
      setPausing(false);
    }
  };

  return (
    <>
      <StackHeader title="Location & privacy" backTo="/settings" />
      <div className="screen privacy-screen">
        <div className="glass privacy-row">
          <span className="ms" style={{ color: "var(--ok)" }} aria-hidden="true">share_location</span>
          <div className="privacy-main">
            <div className="privacy-title">Share with my squads</div>
            <div className="privacy-sub">Master switch · foreground only</div>
          </div>
          <button
            className={`toggle${optedIn ? " on" : ""}`}
            role="switch"
            aria-checked={optedIn}
            aria-label="Share with my squads"
            onClick={() => setSharingOptIn(!optedIn)}
          />
        </div>

        <div className="label privacy-label">Default mode</div>
        <div className="seg privacy-seg" role="radiogroup" aria-label="Default sharing mode">
          {MODES.map((m) => (
            <button
              key={m.mode}
              className={defaultMode === m.mode ? "on" : ""}
              role="radio"
              aria-checked={defaultMode === m.mode}
              onClick={() => setDefaultShareMode(m.mode)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="glass privacy-row">
          <span className="ms" style={{ color: "var(--accent)" }} aria-hidden="true">timer</span>
          <div className="privacy-main">
            <div className="privacy-title">Precise auto-expiry</div>
            <div className="privacy-sub">Live pin turns off automatically</div>
          </div>
          <div className="privacy-stepper">
            <button
              className="privacy-step"
              aria-label="Less time"
              disabled={minutes <= PRECISE_MIN}
              onClick={() => setPreciseMinutes(minutes - PRECISE_STEP)}
            >
              <span className="ms" aria-hidden="true">remove</span>
            </button>
            <span className="privacy-step-value">{minutes}m</span>
            <button
              className="privacy-step"
              aria-label="More time"
              disabled={minutes >= PRECISE_MAX}
              onClick={() => setPreciseMinutes(minutes + PRECISE_STEP)}
            >
              <span className="ms" aria-hidden="true">add</span>
            </button>
          </div>
        </div>

        <div className="glass privacy-row">
          <span className="ms" aria-hidden="true">group</span>
          <div className="privacy-main">
            <div className="privacy-title">Who can see me</div>
            <div className="privacy-sub">Squad members only</div>
          </div>
          <span className="pill pill-default">Squad-only</span>
        </div>

        <div className="glass privacy-row">
          <span className="ms" style={{ color: "var(--danger-ink)" }} aria-hidden="true">visibility_off</span>
          <div className="privacy-main">
            <div className="privacy-title">Pause all sharing</div>
            <div className="privacy-sub">Go invisible everywhere</div>
          </div>
          <button
            className={`toggle${paused ? " on" : ""}`}
            role="switch"
            aria-checked={paused}
            aria-label="Pause all sharing"
            disabled={pausing}
            onClick={togglePauseAll}
          />
        </div>

        <div className="privacy-note">
          <span className="ms" aria-hidden="true">info</span>
          <span>We never share your location publicly or sell it. Foreground only — no background tracking.</span>
        </div>
      </div>
    </>
  );
}
