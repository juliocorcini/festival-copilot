/**
 * Local notifications boundary (E25/DEC-105). The honest, reliable path for a PWA: while the app is
 * open, fire a system notification through the Service Worker registration (so it shows even when the
 * tab is backgrounded on mobile), and **degrade to an in-app toast** when permission is missing or the
 * platform can't show one. We do NOT promise closed-app delivery — that needs server Web Push (a later,
 * flagged tier; iOS PWA push is unreliable today). This module is the only place that touches the
 * Notification / Service Worker APIs, so the scheduler and UI stay pure-ish and testable.
 */
import { toast } from "./toast";
import type { ScheduledReminder } from "../domain/reminders";
import type { TranslateFn } from "../i18n";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

const ICON = "/icons/icon-192.png";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && typeof window.Notification !== "undefined";
}

export function notificationPermission(): NotifPermission {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission as NotifPermission;
}

/** Ask the OS for permission (only meaningful from a user gesture). Resolves to the resulting state. */
export async function requestNotificationPermission(): Promise<NotifPermission> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotifPermission;
  } catch {
    return notificationPermission();
  }
}

/**
 * Show one system notification. Prefers the SW registration (persistent, survives a backgrounded tab on
 * mobile), falling back to a page `Notification`. Returns false when it couldn't show one (no permission
 * / unsupported / threw) so the caller can degrade in-app.
 */
export async function showLocalNotification(
  title: string,
  body: string,
  options: { tag?: string; url?: string } = {}
): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const data = options.url ? { url: options.url } : undefined;
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, { body, tag: options.tag, icon: ICON, badge: ICON, data });
        return true;
      }
    }
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag: options.tag, icon: ICON });
    return true;
  } catch {
    return false;
  }
}

/** Title + body copy for a reminder, in the active language. */
export function reminderCopy(reminder: ScheduledReminder, t: TranslateFn): { title: string; body: string } {
  if (reminder.kind === "leave-by") {
    return {
      title: t("notif.leaveByTitle", { artist: reminder.artistLabel }),
      body: t("notif.leaveByBody", { min: reminder.minutes, stage: reminder.stageName }),
    };
  }
  return {
    title: reminder.artistLabel,
    body: t("notif.setStartBody", { min: reminder.minutes, stage: reminder.stageName }),
  };
}

/**
 * Fire a reminder: a system notification when possible, otherwise an in-app toast while the app is on
 * screen — so a denied/blocked permission still nudges the user instead of failing silently.
 */
export async function fireReminder(reminder: ScheduledReminder, t: TranslateFn): Promise<void> {
  const { title, body } = reminderCopy(reminder, t);
  const shown = await showLocalNotification(title, body, { tag: reminder.id });
  if (!shown && typeof document !== "undefined" && document.visibilityState === "visible") {
    toast.info(`${title} · ${body}`, { key: reminder.id, icon: "notifications" });
  }
}

/** Fire a sample notification so the user can verify reminders work (Settings → Notifications). */
export async function sendTestNotification(t: TranslateFn): Promise<void> {
  const title = t("notif.testTitle");
  const body = t("notif.testBody");
  const shown = await showLocalNotification(title, body, { tag: "fp-test" });
  if (!shown) toast.info(`${title} · ${body}`, { key: "fp-test", icon: "notifications" });
}
