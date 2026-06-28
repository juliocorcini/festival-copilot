import { useNavigate } from "react-router-dom";
import { StackHeader } from "../../app/StackHeader";
import { useAppearance, useAutoShareOnJoin, useLanguage, useNotificationsEnabled } from "../../app/settings";
import { useT } from "../../i18n";
import { APP_VERSION } from "../../data/changelog";

const APPEARANCE_KEY = { auto: "appearance.auto", day: "appearance.day", night: "appearance.night" } as const;
const LANGUAGE_LABEL: Record<string, string> = { en: "English", pt: "Português" };

export function SettingsScreen(): JSX.Element {
  const navigate = useNavigate();
  const t = useT();
  const { mode } = useAppearance();
  const { language } = useLanguage();
  const { autoShare, setAutoShare } = useAutoShareOnJoin();
  const { enabled: notifEnabled } = useNotificationsEnabled();

  return (
    <>
      <StackHeader title={t("settings.title")} backTo="/" />
      <div className="screen">
        <section className="glass" style={{ overflow: "hidden" }}>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/appearance")}>
            <span className="ms">palette</span>
            <span className="row-main">
              <span className="row-title">{t("settings.appearanceLang")}</span>
              <span className="row-sub">
                {t("settings.appearanceLangSub", {
                  appearance: t(APPEARANCE_KEY[mode]),
                  language: LANGUAGE_LABEL[language],
                })}
              </span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/festival")}>
            <span className="ms">festival</span>
            <span className="row-main">
              <span className="row-title">{t("settings.festival")}</span>
              <span className="row-sub">{t("settings.festivalSub")}</span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/offline")}>
            <span className="ms">cloud_done</span>
            <span className="row-main">
              <span className="row-title">{t("settings.offline")}</span>
              <span className="row-sub">{t("settings.offlineSub")}</span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
        </section>

        <section className="glass" style={{ overflow: "hidden" }}>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/notifications")}>
            <span className="ms">notifications</span>
            <span className="row-main">
              <span className="row-title">{t("settings.notifications")}</span>
              <span className="row-sub">{notifEnabled ? t("notif.settingsOn") : t("notif.settingsOff")}</span>
            </span>
            <span className="ms" style={{ color: "var(--muted)" }}>chevron_right</span>
          </button>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/privacy")}>
            <span className="ms">share_location</span>
            <span className="row-main">
              <span className="row-title">{t("settings.privacy")}</span>
              <span className="row-sub">{t("settings.privacySub")}</span>
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
              <span className="row-title">{t("settings.autoShare")}</span>
              <span className="row-sub">{t("settings.autoShareSub")}</span>
            </span>
            <span className={`toggle${autoShare ? " on" : ""}`} aria-hidden="true" />
          </button>
        </section>

        <section className="glass" style={{ overflow: "hidden" }}>
          <button className="row" style={rowButton} onClick={() => navigate("/settings/about")}>
            <span className="ms">info</span>
            <span className="row-main">
              <span className="row-title">{t("settings.about")}</span>
              <span className="row-sub">{t("settings.aboutSub")}</span>
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
