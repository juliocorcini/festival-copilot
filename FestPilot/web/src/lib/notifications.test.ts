import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireReminder,
  notificationPermission,
  notificationsSupported,
  reminderCopy,
  requestNotificationPermission,
  showLocalNotification,
} from "./notifications";
import { _resetToasts, getToasts } from "./toast";
import type { ScheduledReminder } from "../domain/reminders";

class FakeNotification {
  static permission: NotificationPermission = "granted";
  static requestPermission = vi.fn(async () => FakeNotification.permission);
  static instances: Array<{ title: string; opts: unknown }> = [];
  constructor(title: string, opts: unknown) {
    FakeNotification.instances.push({ title, opts });
  }
}

beforeEach(() => {
  _resetToasts();
  FakeNotification.permission = "granted";
  FakeNotification.instances = [];
  FakeNotification.requestPermission.mockClear();
  vi.stubGlobal("Notification", FakeNotification);
  // No SW registration in the test env → showLocalNotification falls back to `new Notification(...)`.
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const reminder: ScheduledReminder = {
  id: "s1:leave-by",
  kind: "leave-by",
  setId: "s1",
  fireAtMs: 0,
  artistLabel: "Charlotte de Witte",
  stageName: "MAINSTAGE",
  minutes: 5,
};

const t = (key: string, vars?: Record<string, string | number>): string =>
  vars ? `${key}:${Object.values(vars).join(",")}` : key;

describe("notifications boundary — permission (E25/DEC-105)", () => {
  it("reports support + the current permission", () => {
    expect(notificationsSupported()).toBe(true);
    expect(notificationPermission()).toBe("granted");
    FakeNotification.permission = "denied";
    expect(notificationPermission()).toBe("denied");
  });

  it("requests permission through the OS and returns the result", async () => {
    FakeNotification.permission = "granted";
    await expect(requestNotificationPermission()).resolves.toBe("granted");
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce();
  });

  it("treats a missing Notification API as unsupported (no throw)", () => {
    vi.stubGlobal("Notification", undefined);
    expect(notificationsSupported()).toBe(false);
    expect(notificationPermission()).toBe("unsupported");
  });
});

describe("notifications boundary — showing", () => {
  it("shows a notification when granted", async () => {
    FakeNotification.permission = "granted";
    await expect(showLocalNotification("Hi", "Body", { tag: "x" })).resolves.toBe(true);
    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0]!.title).toBe("Hi");
  });

  it("does not show (returns false) when permission is denied", async () => {
    FakeNotification.permission = "denied";
    await expect(showLocalNotification("Hi", "Body")).resolves.toBe(false);
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("degrades to an in-app toast when it can't show a system notification while visible", async () => {
    FakeNotification.permission = "denied";
    await fireReminder(reminder, t);
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0]!.message).toContain("notif.leaveByTitle");
  });
});

describe("reminderCopy", () => {
  it("uses the artist as title and a walk body for leave-by", () => {
    const { title, body } = reminderCopy(reminder, t);
    expect(title).toBe("notif.leaveByTitle:Charlotte de Witte");
    expect(body).toBe("notif.leaveByBody:5,MAINSTAGE");
  });

  it("uses the artist as title and a 'starts in' body for set-start", () => {
    const { title, body } = reminderCopy({ ...reminder, kind: "set-start", minutes: 10 }, t);
    expect(title).toBe("Charlotte de Witte");
    expect(body).toBe("notif.setStartBody:10,MAINSTAGE");
  });
});
