/**
 * Notifications settings (E25/DEC-105). The in-context opt-in: enabling here asks for OS permission,
 * then turns on the local reminder scheduler. The copy is deliberately honest — reminders fire while
 * the app is open, and a blocked/absent permission degrades to in-app nudges rather than failing
 * silently. A "send a test" button lets the user confirm it works without waiting for a set.
 */
import { useEffect, useState } from "react";
import { StackHeader } from "../../app/StackHeader";
import { useNotificationsEnabled } from "../../app/settings";
import {
  notificationPermission,
  requestNotificationPermission,
  sendTestNotification,
  type NotifPermission,
} from "../../lib/notifications";
import { useT, type MessageKey } from "../../i18n";

const STATUS_KEY: Record<NotifPermission, MessageKey> = {
  granted: "notif.statusGranted",
  default: "notif.statusDefault",
  denied: "notif.statusDenied",
  unsupported: "notif.statusUnsupported",
};

export function NotificationsScreen(): JSX.Element {
  const t = useT();
  const { enabled, setEnabled } = useNotificationsEnabled();
  const [perm, setPerm] = useState<NotifPermission>(() => notificationPermission());

  // The user may flip permission in the browser UI and return — re-read it on focus.
  useEffect(() => {
    const sync = (): void => setPerm(notificationPermission());
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const supported = perm !== "unsupported";

  const toggle = async (): Promise<void> => {
    if (enabled) {
      setEnabled(false);
      return;
    }
    // Turning on: ask for permission in context (a no-op if already decided), then enable either way —
    // even when blocked, the scheduler still nudges in-app while the app is open.
    if (notificationPermission() === "default") setPerm(await requestNotificationPermission());
    setEnabled(true);
  };

  return (
    <>
      <StackHeader title={t("settings.notifications")} backTo="/settings" />
      <div className="screen">
        <p className="settings-intro">{t("notif.intro")}</p>

        <section className="glass" style={{ overflow: "hidden" }}>
          <button
            className="row"
            style={rowButton}
            role="switch"
            aria-checked={enabled}
            disabled={!supported}
            onClick={() => void toggle()}
          >
            <span className="ms">notifications_active</span>
            <span className="row-main">
              <span className="row-title">{t("notif.enable")}</span>
              <span className="row-sub">{t("notif.enableSub")}</span>
            </span>
            <span className={`toggle${enabled ? " on" : ""}`} aria-hidden="true" />
          </button>
        </section>

        <p className={`notif-status${perm === "denied" ? " warn" : ""}`}>{t(STATUS_KEY[perm])}</p>

        <section className="glass notif-what">
          <div className="notif-what-title">{t("notif.whatTitle")}</div>
          <div className="notif-what-row">
            <span className="ms">schedule</span>
            <span>{t("notif.whatSet")}</span>
          </div>
          <div className="notif-what-row">
            <span className="ms">directions_walk</span>
            <span>{t("notif.whatLeave")}</span>
          </div>
        </section>

        {supported && (
          <button className="btn btn-ghost" style={{ marginTop: 14 }} onClick={() => void sendTestNotification(t)}>
            <span className="ms">notifications</span>
            {t("notif.test")}
          </button>
        )}

        <p className="settings-intro" style={{ marginTop: 18 }}>{t("notif.openAppNote")}</p>
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
