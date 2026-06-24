import { useNavigate } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useAppearance, useAutoShareOnJoin, useLanguage } from "../../app/settings";
import { APP_VERSION } from "../../data/changelog";

const APPEARANCE_LABEL: Record<string, string> = { auto: "Auto", day: "Day", night: "Night" };
const LANGUAGE_LABEL: Record<string, string> = { en: "English", pt: "Português" };

export function SettingsScreen(): JSX.Element {
  const navigate = useNavigate();
  const { mode } = useAppearance();
  const { language } = useLanguage();
  const { autoShare, setAutoShare } = useAutoShareOnJoin();

  return (
    <>
      <StackHeader title="Settings" backTo="/" />
      <div className="screen">
        <section className="glass" style={{ overflow: "hidden" }}>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/appearance")}>
            <span className="ms">palette</span>
            <span className="row-main">
              <span className="row-title">Appearance &amp; language</span>
              <span className="row-sub">
                {APPEARANCE_LABEL[mode]} · {LANGUAGE_LABEL[language]}
              </span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/offline")}>
            <span className="ms">cloud_done</span>
            <span className="row-main">
              <span className="row-title">Offline &amp; data</span>
              <span className="row-sub">Cached for offline use on site</span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
        </section>

        <section className="glass" style={{ overflow: "hidden" }}>
          <div className="row">
            <span className="ms">notifications</span>
            <span className="row-main">
              <span className="row-title">Notifications</span>
              <span className="row-sub">Set alerts coming in a later phase</span>
            </span>
            <span className="pill">Soon</span>
          </div>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/privacy")}>
            <span className="ms">share_location</span>
            <span className="row-main">
              <span className="row-title">Location &amp; privacy</span>
              <span className="row-sub">Master switch · default mode · pause all</span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
          <button
            className="row"
            style={rowButton}
            role="switch"
            aria-checked={autoShare}
            onClick={() => setAutoShare(!autoShare)}
          >
            <span className="ms">ios_share</span>
            <span className="row-main">
              <span className="row-title">Auto-share plan when I join a squad</span>
              <span className="row-sub">Offer to share your plan + favorites on join (DEC-054)</span>
            </span>
            <span className={`toggle${autoShare ? " on" : ""}`} aria-hidden="true" />
          </button>
        </section>

        <section className="glass" style={{ overflow: "hidden" }}>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/about")}>
            <span className="ms">info</span>
            <span className="row-main">
              <span className="row-title">About &amp; what's new</span>
              <span className="row-sub">Version, the story, and the update history</span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
        </section>

        <p className="src" style={{ textAlign: "center" }}>FestPilot · v{APP_VERSION}</p>
      </div>
    </>
  );
}

const rowButton: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: "none",
  width: "100%",
  textAlign: "left",
  cursor: "pointer",
  color: "inherit",
};
