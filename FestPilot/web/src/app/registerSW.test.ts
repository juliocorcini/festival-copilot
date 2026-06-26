import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyUpdate,
  checkForUpdate,
  forceUpdate,
  hasWaitingUpdate,
  onUpdateReady,
  registerServiceWorker,
  UPDATE_READY_EVENT,
} from "./registerSW";

function setServiceWorker(register: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, getRegistration: vi.fn().mockResolvedValue(undefined), addEventListener: vi.fn() },
  });
}

function stubServiceWorker(value: unknown): void {
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("registerServiceWorker", () => {
  it("does not register outside production", () => {
    vi.stubEnv("PROD", false);
    const register = vi.fn();
    setServiceWorker(register);
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    expect(register).not.toHaveBeenCalled();
  });

  it("registers a version-stamped /sw.js on window load in production", async () => {
    vi.stubEnv("PROD", true);
    const reg = { addEventListener: vi.fn(), update: vi.fn().mockResolvedValue(undefined), waiting: null, installing: null };
    const register = vi.fn().mockResolvedValue(reg);
    setServiceWorker(register);
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(1);
    // Version-stamped URL so each release is a distinct worker the browser will re-install.
    expect(register.mock.calls[0][0]).toMatch(/^\/sw\.js\?v=.+/);
  });
});

describe("checkForUpdate", () => {
  it("reports unsupported when there is no registration", async () => {
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(undefined), controller: {} });
    expect(await checkForUpdate()).toBe("unsupported");
  });

  it("reports a waiting worker as an available update", async () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: {}, installing: null };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg), controller: {} });
    expect(await checkForUpdate()).toBe("updated");
    expect(reg.update).toHaveBeenCalled();
  });

  it("reports current when controlled and nothing is waiting/installing", async () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: null, installing: null };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg), controller: {} });
    expect(await checkForUpdate()).toBe("current");
  });

  it("does not claim an update on the very first install (no controller yet)", async () => {
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: {}, installing: null };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg), controller: null });
    expect(await checkForUpdate()).toBe("current");
  });
});

describe("applyUpdate", () => {
  it("tells the waiting worker to skip waiting", async () => {
    const postMessage = vi.fn();
    const reg = { waiting: { postMessage } };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg) });
    await applyUpdate();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});

describe("forceUpdate", () => {
  it("activates a waiting worker (and re-checks first)", async () => {
    const postMessage = vi.fn();
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: { postMessage } };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg) });
    await forceUpdate();
    expect(reg.update).toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("hard-reloads when nothing is waiting", async () => {
    const reload = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { reload } });
    const reg = { update: vi.fn().mockResolvedValue(undefined), waiting: null };
    stubServiceWorker({ getRegistration: vi.fn().mockResolvedValue(reg) });
    await forceUpdate();
    expect(reload).toHaveBeenCalled();
    Object.defineProperty(window, "location", { configurable: true, value: original });
  });
});

describe("update signal", () => {
  it("does not fire before any update is known, and unsubscribes cleanly", () => {
    const cb = vi.fn();
    const off = onUpdateReady(cb);
    expect(cb).not.toHaveBeenCalled();
    expect(hasWaitingUpdate()).toBe(false);
    off();
    window.dispatchEvent(new Event(UPDATE_READY_EVENT));
    expect(cb).not.toHaveBeenCalled();
  });

  // Runs last: announcing flips module-level state that persists for the rest of the file.
  it("announces a waiting worker on load and flags the update as ready", async () => {
    vi.stubEnv("PROD", true);
    const reg = {
      waiting: {},
      installing: null,
      update: vi.fn().mockResolvedValue(undefined),
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: vi.fn().mockResolvedValue(reg), getRegistration: vi.fn(), addEventListener: vi.fn(), controller: {} },
    });
    const cb = vi.fn();
    const off = onUpdateReady(cb);
    registerServiceWorker();
    window.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();
    expect(cb).toHaveBeenCalled();
    expect(hasWaitingUpdate()).toBe(true);
    off();
  });
});
